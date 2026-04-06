import type { SessionType } from "./types.js";

interface AISuggestionResponse {
    category: string;
    text: string;
}

export async function generateSuggestions(input: {
    type: SessionType;
    title: string;
    content: string;
    goal?: string | null;
    documentText?: string | null;
    focusText?: string | null;
}) {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
        return {
            unavailable: true,
            message:
                "AI tool unavailable. You can continue using this app as a brainstorming workspace without AI suggestions.",
            suggestions: [] as AISuggestionResponse[]
        };
    }

    const context = [
        `Session type: ${input.type}`,
        `Title: ${input.title}`,
        `Goal: ${input.goal ?? "none"}`,
        `Content:\n${input.content || "(empty)"}`,
        input.documentText ? `Document excerpt:\n${input.documentText.slice(0, 4000)}` : "",
        input.focusText ? `User highlighted this section:\n${input.focusText}` : ""
    ]
        .filter(Boolean)
        .join("\n\n");

    const focusInstruction = input.focusText
        ? "Prioritize suggestions that directly improve or expand the highlighted section."
        : "Generate suggestions based on the overall note content.";

    const typeInstructionBySession: Record<SessionType, string> = {
        brainstorm:
            "Treat this as open-ended ideation. Offer creative extensions, provocative challenges, and alternatives.",
        "project-planning":
            "Treat this as document-informed ideation. Anchor suggestions in the provided goal and excerpt.",
        "reading-assistance":
            "Treat this as reading assistance. Explain difficult sections simply, define terms, and offer concise context.",
        "prompted-brainstorming":
            ""
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL,
            temperature: 0.7,
            messages: [
                {
                    role: "system",
                    content:
                        "You are an ideation copilot. Return exactly 3 concise JSON suggestions with categories from extension, challenge, alternative, summary, rewrite."
                },
                {
                    role: "user",
                    content: `${typeInstructionBySession[input.type]}\n${focusInstruction}\n\n${context}\n\nReturn JSON array only like [{\"category\":\"extension\",\"text\":\"...\"}]`
                }
            ]
        })
    });

    if (!response.ok) {
        return {
            unavailable: true,
            message:
                "AI tool unavailable. You can continue using this app as a brainstorming workspace without AI suggestions.",
            suggestions: [] as AISuggestionResponse[]
        };
    }

    const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = data.choices?.[0]?.message?.content ?? "[]";
    try {
        const parsed = JSON.parse(raw) as AISuggestionResponse[];
        return {
            unavailable: false,
            message: "",
            suggestions: parsed.slice(0, 3)
        };
    } catch {
        return {
            unavailable: true,
            message:
                "AI tool unavailable. You can continue using this app as a brainstorming workspace without AI suggestions.",
            suggestions: [] as AISuggestionResponse[]
        };
    }
}

export async function generateProjectSpec(input: {
    title: string;
    content: string;
    goal?: string | null;
    documentText?: string | null;
}) {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
        const fallback = [
            "## Project Spec",
            "",
            `### Plan Name`,
            input.title,
            "",
            "### Planning Prompt",
            input.goal?.trim() || "(Add planning prompt)",
            "",
            "### Problem Statement",
            "(Summarize the problem this plan addresses.)",
            "",
            "### Proposed Features",
            "- ",
            "",
            "### Milestones",
            "1. Discovery",
            "2. Build",
            "3. Validation",
            "",
            "### Risks & Assumptions",
            "- Risk: ",
            "- Assumption: ",
            "",
            "### Success Metrics",
            "- "
        ].join("\n");

        return { unavailable: true, message: "AI tool unavailable. Added a starter project spec template instead.", spec: fallback };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL,
            temperature: 0.5,
            messages: [
                {
                    role: "system",
                    content:
                        "You are a product planning copilot. Produce a concise, editable markdown project spec with practical sections and actionable bullets."
                },
                {
                    role: "user",
                    content: `Create a project spec from these notes.\n\nTitle: ${input.title}\nPlanning prompt: ${input.goal ?? "none"}\nNotes:\n${input.content || "(empty)"}\n\nReference text:\n${input.documentText?.slice(0, 4000) ?? "(none)"}\n\nReturn markdown only with sections for Problem Statement, Plan Goals, Scope (In/Out), Features, Milestones, Risks, Open Questions, and Success Metrics.`
                }
            ]
        })
    });

    if (!response.ok) {
        return {
            unavailable: true,
            message: "AI tool unavailable. Unable to generate a project spec right now.",
            spec: ""
        };
    }

    const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    const spec = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!spec) {
        return {
            unavailable: true,
            message: "AI tool unavailable. Unable to generate a project spec right now.",
            spec: ""
        };
    }

    return { unavailable: false, message: "", spec };
}