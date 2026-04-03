export type SessionType = 'brainstorm' | 'project-planning' | 'prompted-brainstorming';

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
    category: string;
    text: string;
    state: 'pending' | 'accepted' | 'dismissed';
    created_at: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return null as T;
    }

    return (await response.json()) as T;
}

export const api = {
    listSessions: (search = '', type = 'all') =>
        request<Session[]>(`/sessions?search=${encodeURIComponent(search)}&type=${encodeURIComponent(type)}`),
    createSession: (payload: { title: string; type: SessionType; goal?: string; documentText?: string }) =>
        request<Session>('/sessions', { method: 'POST', body: JSON.stringify(payload) }),
    getSession: (id: number) =>
        request<{ session: Session; suggestions: Suggestion[] }>(`/sessions/${id}`),
    updateSession: (id: number, payload: Partial<{ title: string; content: string; goal: string; documentText: string }>) =>
        request<Session>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteSession: (id: number) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
    generateSuggestions: (id: number, payload?: { refresh?: boolean; focusText?: string }) =>
        request<{ unavailable: boolean; message: string; suggestions: Suggestion[] }>(`/sessions/${id}/suggestions`, {
            method: 'POST',
            body: JSON.stringify(payload ?? {})
        }),
    updateSuggestionState: (id: number, state: 'pending' | 'accepted' | 'dismissed') =>
        request<Suggestion>(`/suggestions/${id}`, { method: 'PATCH', body: JSON.stringify({ state }) }),
    exportPdfUrl: (id: number) => `${API_BASE}/sessions/${id}/export`
};
