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
        input.documentText ? `Document excerpt:\n${input.documentText.slice(0, 4000)}` : ""
    ]
        .filter(Boolean)
        .join("\n\n");

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
                    content: `${context}\n\nReturn JSON array only like [{\"category\":\"extension\",\"text\":\"...\"}]`
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
