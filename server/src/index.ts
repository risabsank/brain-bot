import "dotenv/config";
import cors from "cors";
import express from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { generateProjectSpec, generateSuggestions } from "./ai.js";
import { db, initDb } from "./db.js";
import type { Session, SessionType, SuggestionCategory } from "./types.js";

initDb();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const createSessionSchema = z.object({
    title: z.string().min(1),
    type: z.enum(["brainstorm", "project-planning", "prompted-brainstorming"]),
    goal: z.string().optional().nullable(),
    documentText: z.string().optional().nullable()
});

const updateSessionSchema = z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    goal: z.string().optional().nullable(),
    documentText: z.string().optional().nullable()
});

const suggestionRequestSchema = z.object({
    refresh: z.boolean().optional(),
    focusText: z.string().optional().nullable()
});

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/sessions", (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const type = String(req.query.type ?? "all");

    let query = "SELECT * FROM sessions WHERE 1=1";
    const params: Array<string> = [];

    if (search) {
        query += " AND (title LIKE ? OR content LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    if (type !== "all") {
        query += " AND type = ?";
        params.push(type);
    }

    query += " ORDER BY datetime(updated_at) DESC";

    const rows = db.prepare(query).all(...params);
    res.json(rows);
});

app.get("/sessions/:id", (req, res) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const suggestions = db
        .prepare("SELECT * FROM suggestions WHERE session_id = ? ORDER BY datetime(created_at) DESC")
        .all(req.params.id);

    res.json({ session, suggestions });
});

app.post("/sessions", (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const now = new Date().toISOString();
    const stmt = db.prepare(
        "INSERT INTO sessions(title, type, goal, document_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
        parsed.data.title,
        parsed.data.type,
        parsed.data.goal ?? null,
        parsed.data.documentText ?? null,
        now,
        now
    );

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(session);
});

app.patch("/sessions/:id", (req, res) => {
    const parsed = updateSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const existing = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as Session | undefined;
    if (!existing) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const next = {
        title: parsed.data.title ?? existing.title,
        content: parsed.data.content ?? existing.content,
        goal: parsed.data.goal ?? existing.goal,
        documentText: parsed.data.documentText ?? existing.document_text,
        updated_at: new Date().toISOString()
    };

    db.prepare(
        "UPDATE sessions SET title = ?, content = ?, goal = ?, document_text = ?, updated_at = ? WHERE id = ?"
    ).run(next.title, next.content, next.goal, next.documentText, next.updated_at, req.params.id);

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
    res.json(session);
});

app.delete("/sessions/:id", (req, res) => {
    db.prepare("DELETE FROM suggestions WHERE session_id = ?").run(req.params.id);
    db.prepare("DELETE FROM sessions WHERE id = ?").run(req.params.id);
    res.status(204).send();
});

app.post("/sessions/:id/suggestions", async (req, res) => {
    const parsed = suggestionRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as Session | undefined;
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const generated = await generateSuggestions({
        type: session.type as SessionType,
        title: session.title,
        content: session.content,
        goal: session.goal,
        documentText: session.document_text,
        focusText: parsed.data.focusText
    });

    if (generated.unavailable) {
        res.status(200).json(generated);
        return;
    }

    if (parsed.data.refresh) {
        db.prepare("DELETE FROM suggestions WHERE session_id = ? AND state = 'pending'").run(req.params.id);
    }

    const pendingCountRow = db
        .prepare("SELECT COUNT(*) as count FROM suggestions WHERE session_id = ? AND state = 'pending'")
        .get(req.params.id) as { count: number };
    const needed = Math.max(0, 3 - pendingCountRow.count);

    const now = new Date().toISOString();
    const insert = db.prepare(
        "INSERT INTO suggestions(session_id, category, text, state, created_at) VALUES (?, ?, ?, 'pending', ?)"
    );

    generated.suggestions.slice(0, needed).forEach((item) => {
        insert.run(req.params.id, item.category as SuggestionCategory, item.text, now);
    });

    const suggestions = db
        .prepare("SELECT * FROM suggestions WHERE session_id = ? ORDER BY datetime(created_at) DESC")
        .all(req.params.id);

    res.json({ unavailable: false, message: "", suggestions });
});

app.patch("/suggestions/:id", (req, res) => {
    const stateSchema = z.object({ state: z.enum(["pending", "accepted", "dismissed"]) });
    const parsed = stateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload" });
        return;
    }

    db.prepare("UPDATE suggestions SET state = ? WHERE id = ?").run(parsed.data.state, req.params.id);
    const suggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?").get(req.params.id);
    res.json(suggestion);
});

app.post("/sessions/:id/spec", async (req, res) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as Session | undefined;
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const generated = await generateProjectSpec({
        title: session.title,
        content: session.content,
        goal: session.goal,
        documentText: session.document_text
    });

    res.status(200).json(generated);
});

app.get("/sessions/:id/export", (req, res) => {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id) as Session | undefined;
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=session-${session.id}.pdf`);
    doc.pipe(res);

    doc.fontSize(22).text(session.title);
    doc.moveDown(0.5).fontSize(10).text(`Type: ${session.type}`);
    doc.text(`Updated: ${session.updated_at}`);
    doc.moveDown().fontSize(14).text("Content");
    doc.fontSize(11).text(session.content || "(No content yet)");

    if (session.goal) {
        doc.moveDown().fontSize(14).text("Goal");
        doc.fontSize(11).text(session.goal);
    }

    if (session.document_text) {
        doc.moveDown().fontSize(14).text("Document Notes");
        doc.fontSize(11).text(session.document_text.slice(0, 2000));
    }

    doc.end();
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
