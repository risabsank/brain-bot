export type SessionType = "brainstorm" | "project-planning" | "prompted-brainstorming";

export type SuggestionCategory =
    | "extension"
    | "challenge"
    | "alternative"
    | "summary"
    | "rewrite";

export interface Session {
    id: number;
    title: string;
    type: SessionType;
    content: string;
    goal: string | null;
    document_text: string | null;
    created_at: string;
    updated_at: string;
}

export interface Suggestion {
    id: number;
    session_id: number;
    category: SuggestionCategory;
    text: string;
    state: "pending" | "accepted" | "dismissed";
    created_at: string;
}
