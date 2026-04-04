import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { NewSessionModal } from './components/NewSessionModal';
import { api, type Session, type SessionType, type Suggestion } from './lib/api';

const starterByType: Record<SessionType, string> = {
    brainstorm: 'Capture rough ideas. Save to get expansions, critiques, and alternative paths.',
    'project-planning': 'Structure your plan: problem, goals, users, constraints, milestones, risks.',
    'prompted-brainstorming': 'Use your source text + outcome goal to generate strategic responses.'
};

function App() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);
    const [generatingSpec, setGeneratingSpec] = useState(false);
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isAssistantVisible, setIsAssistantVisible] = useState(true);
    const [isAutoPolling, setIsAutoPolling] = useState(true);
    const [pollingIntervalMs, setPollingIntervalMs] = useState(1400);
    const autoRefreshTimer = useRef<number | null>(null);
    const editorRef = useRef<HTMLTextAreaElement | null>(null);

    const activeHint = useMemo(() => {
        if (!activeSession) return 'Choose or create a session to start.';
        return starterByType[activeSession.type];
    }, [activeSession]);

    const pendingSuggestions = useMemo(
        () => suggestions.filter((suggestion) => suggestion.state === 'pending'),
        [suggestions]
    );

    async function loadSessions() {
        const data = await api.listSessions(search, filterType);
        setSessions(data);
    }

    useEffect(() => {
        void loadSessions();
    }, [search, filterType]);

    async function refreshSuggestions(sessionId: number, focusText?: string) {
        const generated = await api.generateSuggestions(sessionId, { refresh: true, focusText });
        if (generated.unavailable) {
            setNotice(generated.message);
            return;
        }
        setSuggestions(generated.suggestions);
        setNotice(focusText ? 'AI suggestions updated for highlighted text.' : 'AI suggestions refreshed.');
    }

    async function openSession(id: number) {
        const data = await api.getSession(id);
        setActiveSession(data.session);
        setSuggestions(data.suggestions);
        setSelectionRange(null);
        setNotice('');
    }

    async function createSession(payload: { title: string; type: SessionType; goal?: string; documentText?: string }) {
        const session = await api.createSession(payload);
        setModalOpen(false);
        await loadSessions();
        await openSession(session.id);
    }

    async function saveSession() {
        if (!activeSession) return;
        setSaving(true);
        const updated = await api.updateSession(activeSession.id, {
            title: activeSession.title,
            content: activeSession.content,
            goal: activeSession.goal ?? '',
            documentText: activeSession.document_text ?? ''
        });
        setActiveSession(updated);
        await loadSessions();

        await refreshSuggestions(updated.id);

        setSaving(false);
    }

    async function generateSpec() {
        if (!activeSession || activeSession.type !== 'project-planning') return;
        setGeneratingSpec(true);
        const generated = await api.generateProjectSpec(activeSession.id);

        const existing = activeSession.content.trimEnd();
        const nextContent = generated.spec
            ? `${existing}${existing ? '\n\n' : ''}${generated.spec}`
            : existing;
        const updatedSession = await api.updateSession(activeSession.id, { content: nextContent });
        setActiveSession(updatedSession);
        setNotice(generated.message || 'Project spec generated and inserted below your notes.');
        setGeneratingSpec(false);
    }

    async function removeSession(id: number) {
        await api.deleteSession(id);
        if (activeSession?.id === id) {
            setActiveSession(null);
            setSuggestions([]);
            setSelectionRange(null);
        }
        await loadSessions();
    }

    async function setSuggestionState(id: number, state: 'accepted' | 'dismissed') {
        if (!activeSession) return;
        const selectedSuggestion = suggestions.find((item) => item.id === id);
        if (state === 'accepted' && selectedSuggestion) {
            const suggestionLine = `\n- ${selectedSuggestion.text}`;
            if (
                selectionRange &&
                selectionRange.start !== selectionRange.end &&
                selectionRange.end <= activeSession.content.length
            ) {
                const before = activeSession.content.slice(0, selectionRange.end);
                const after = activeSession.content.slice(selectionRange.end);
                const updatedContent = `${before}${suggestionLine}${after}`;
                const updatedSession = await api.updateSession(activeSession.id, { content: updatedContent });
                setActiveSession(updatedSession);
            } else {
                const nextContent = activeSession.content.includes('\nAccepted AI suggestions\n')
                    ? `${activeSession.content}${suggestionLine}`
                    : `${activeSession.content.trimEnd()}\n\nAccepted AI suggestions\n${suggestionLine}`;
                const updatedSession = await api.updateSession(activeSession.id, { content: nextContent });
                setActiveSession(updatedSession);
            }
        }

        await api.updateSuggestionState(id, state);
        setSuggestions((current) => current.map((suggestion) => (suggestion.id === id ? { ...suggestion, state } : suggestion)));
        await loadSessions();
    }

    function applyEditorValue(nextValue: string, nextCursor: number) {
        if (!activeSession) return;
        setActiveSession({ ...activeSession, content: nextValue });
        window.requestAnimationFrame(() => {
            if (editorRef.current) {
                editorRef.current.selectionStart = nextCursor;
                editorRef.current.selectionEnd = nextCursor;
            }
        });
    }

    function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (!activeSession) return;
        const target = event.currentTarget;
        const { selectionStart, selectionEnd, value } = target;

        if (event.key === 'Tab') {
            event.preventDefault();
            const indent = '    ';
            const nextValue = `${value.slice(0, selectionStart)}${indent}${value.slice(selectionEnd)}`;
            applyEditorValue(nextValue, selectionStart + indent.length);
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLine = value.slice(lineStart, selectionStart);
        const match = currentLine.match(/^(\s*)([-*]|\d+\.)\s+/);
        if (!match) {
            return;
        }

        event.preventDefault();
        const bulletPrefix = `${match[1]}${match[2]} `;
        const nextValue = `${value.slice(0, selectionStart)}\n${bulletPrefix}${value.slice(selectionEnd)}`;
        applyEditorValue(nextValue, selectionStart + bulletPrefix.length + 1);
    }

    useEffect(() => {
        if (
            !activeSession ||
            !['brainstorm', 'project-planning'].includes(activeSession.type) ||
            !isAiEnabled ||
            !isAutoPolling
        ) {
            return;
        }

        if (autoRefreshTimer.current) {
            window.clearTimeout(autoRefreshTimer.current);
        }

        const hasSelection = selectionRange && selectionRange.start !== selectionRange.end;
        if (hasSelection) {
            return;
        }

        autoRefreshTimer.current = window.setTimeout(() => {
            void refreshSuggestions(activeSession.id);
        }, pollingIntervalMs);

        return () => {
            if (autoRefreshTimer.current) {
                window.clearTimeout(autoRefreshTimer.current);
            }
        };
    }, [
        activeSession?.id,
        activeSession?.type,
        activeSession?.content,
        isAiEnabled,
        isAutoPolling,
        pollingIntervalMs,
        selectionRange?.start,
        selectionRange?.end
    ]);
    return (
        <div className="app">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>Brain Bot</h1>
                    <button onClick={() => setModalOpen(true)}>+ New</button>
                </div>

                <input
                    placeholder="Search by title/content"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                    <option value="all">All types</option>
                    <option value="brainstorm">Brainstorm</option>
                    <option value="project-planning">Project Planning</option>
                    <option value="prompted-brainstorming">Prompted Brainstorming</option>
                </select>

                <div className="session-list">
                    {sessions.map((session) => (
                        <div key={session.id} className={`session-card ${activeSession?.id === session.id ? 'active' : ''}`}>
                            <button className="session-main" onClick={() => openSession(session.id)}>
                                <strong>{session.title}</strong>
                                <span>{session.type}</span>
                                <small>{new Date(session.updated_at).toLocaleString()}</small>
                            </button>
                            <button
                                className="session-delete"
                                title="Delete session"
                                onClick={() => removeSession(session.id)}
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className={`workspace ${!isAssistantVisible ? 'no-assistant' : ''}`}>
                <div className="editor-pane">
                    <div className="toolbar">
                        <p>{activeHint}</p>
                        {activeSession && (
                            <div className="toolbar-actions">
                                <a href={api.exportPdfUrl(activeSession.id)} target="_blank" rel="noreferrer">
                                    Export PDF
                                </a>
                                <button onClick={saveSession} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                {activeSession.type === 'project-planning' && (
                                    <button onClick={generateSpec} disabled={generatingSpec}>
                                        {generatingSpec ? 'Generating...' : 'Generate spec'}
                                    </button>
                                )}
                                <button onClick={() => setIsAssistantVisible((visible) => !visible)}>
                                    {isAssistantVisible ? 'Hide AI' : 'Show AI'}
                                </button>
                                <button onClick={() => removeSession(activeSession.id)} className="danger">
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {activeSession ? (
                        <>
                            <input
                                className="title-input"
                                value={activeSession.title}
                                onChange={(event) => setActiveSession({ ...activeSession, title: event.target.value })}
                            />
                            <textarea
                                ref={editorRef}
                                className="editor"
                                value={activeSession.content}
                                onChange={(event) => setActiveSession({ ...activeSession, content: event.target.value })}
                                onKeyDown={handleEditorKeyDown}
                                onSelect={(event) => {
                                    const target = event.currentTarget;
                                    setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
                                }}

                                placeholder="Start writing your ideas here..."
                            />
                        </>
                    ) : (
                        <div className="empty-state">Create or open a session to start ideating.</div>
                    )}
                </div>

                {isAssistantVisible && (
                    <aside className="assistant-pane">
                        <h3>AI Copilot</h3>
                        <div className="assistant-controls">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={isAiEnabled}
                                    onChange={(event) => setIsAiEnabled(event.target.checked)}
                                />
                                AI enabled
                            </label>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={isAutoPolling}
                                    disabled={!isAiEnabled}
                                    onChange={(event) => setIsAutoPolling(event.target.checked)}
                                />
                                Auto polling
                            </label>
                            <label className="interval-input">
                                Poll every
                                <input
                                    type="number"
                                    min={500}
                                    step={100}
                                    value={pollingIntervalMs}
                                    disabled={!isAiEnabled || !isAutoPolling}
                                    onChange={(event) => setPollingIntervalMs(Math.max(500, Number(event.target.value) || 500))}
                                />
                                ms
                            </label>
                            <button
                                disabled={!activeSession || !isAiEnabled}
                                onClick={() => refreshSuggestions(activeSession!.id)}
                            >
                                Refresh now
                            </button>
                        </div>
                        {notice && <div className="notice">{notice}</div>}
                        {!pendingSuggestions.length && (
                            <p className="muted">
                                {isAiEnabled
                                    ? 'Suggestions refresh while you type in brainstorming and project-planning modes.'
                                    : 'AI Copilot is disabled.'}
                            </p>
                        )}
                        <div className="suggestions-list">
                            {pendingSuggestions.map((suggestion) => (
                                <div key={suggestion.id} className="suggestion-card">
                                    <span className="chip">{suggestion.category}</span>
                                    <p>{suggestion.text}</p>
                                    <div className="actions">
                                        <button onClick={() => setSuggestionState(suggestion.id, 'accepted')}>Accept</button>
                                        <button className="ghost" onClick={() => setSuggestionState(suggestion.id, 'dismissed')}>
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </main>

            <NewSessionModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={createSession} />
        </div>
    );
}

export default App;
