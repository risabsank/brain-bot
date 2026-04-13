import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { NewSessionModal } from './components/NewSessionModal';
import { api, type Session, type SessionType, type Suggestion } from './lib/api';

const starterByType: Record<SessionType, string> = {
    brainstorm: 'Drop quick cards like a mood board. Add ideas, AI captions, or image references and shape the concept.',
    'project-planning': 'Build your plan with cards for goals, milestones, blockers, and inspiration.',
    'prompted-brainstorming': 'Capture source ideas as cards, then expand each one with context and follow-up notes.',
    'reading-assistance': 'Paste a link or notes above, keep reading notes below, then highlight text for simple explanations.'
};

type IdeaCard = {
    id: string;
    type: 'text' | 'image';
    title: string;
    caption: string;
    imageUrl: string;
};

const starterCards: IdeaCard[] = [
    {
        id: crypto.randomUUID(),
        type: 'text',
        title: 'Main concept',
        caption: 'What are you trying to create? Keep it lightweight and editable.',
        imageUrl: ''
    }
];

function mapTextToCards(text: string): IdeaCard[] {
    const parts = text
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (!parts.length) return starterCards;

    return parts.map((part) => {
        const [firstLine, ...rest] = part.split('\n');
        return {
            id: crypto.randomUUID(),
            type: 'text',
            title: firstLine.slice(0, 80) || 'Untitled idea',
            caption: rest.join('\n') || firstLine,
            imageUrl: ''
        };
    });
}

function parseBoardContent(content: string): IdeaCard[] {
    const trimmed = content.trim();
    if (!trimmed) return starterCards;

    try {
        const parsed = JSON.parse(trimmed) as IdeaCard[];
        if (Array.isArray(parsed) && parsed.length) {
            return parsed.map((card) => ({
                id: card.id || crypto.randomUUID(),
                type: card.type === 'image' ? 'image' : 'text',
                title: card.title || 'Untitled idea',
                caption: card.caption || '',
                imageUrl: card.imageUrl || ''
            }));
        }
    } catch {
        // fallback to converting plain text into cards
    }

    return mapTextToCards(content);
}

function serializeBoardContent(cards: IdeaCard[]) {
    return JSON.stringify(cards, null, 2);
}

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
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
    const autoRefreshTimer = useRef<number | null>(null);
    const editorRef = useRef<HTMLTextAreaElement | null>(null);

    const activeHint = useMemo(() => {
        if (!activeSession) return 'Choose or create a session to start.';
        return starterByType[activeSession.type];
    }, [activeSession]);


    const boardCards = useMemo(() => {
        if (!activeSession || activeSession.type === 'reading-assistance') return [];
        return parseBoardContent(activeSession.content);
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
        setExpandedCardId(null);
        setNotice('');
    }

    async function createSession(payload: {
        title: string;
        type: SessionType;
        goal?: string;
        documentText?: string;
        sourceSessionId?: number;

    }) {
        const sourceSession = payload.sourceSessionId ? await api.getSession(payload.sourceSessionId) : null;
        const isBoardMode = payload.type !== 'reading-assistance';
        const initialContent = sourceSession?.session.content || '';
        const session = await api.createSession({
            title: payload.title,
            type: payload.type,
            goal: payload.goal,
            documentText: payload.documentText || ''
        });
        if (isBoardMode) {
            await api.updateSession(session.id, { content: serializeBoardContent(parseBoardContent(initialContent)) });
        }
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
            if (activeSession.type === 'reading-assistance') {
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
            } else {
                const cards = parseBoardContent(activeSession.content);
                const nextCards: IdeaCard[] = [
                    {
                        id: crypto.randomUUID(),
                        type: 'text',
                        title: selectedSuggestion.category,
                        caption: selectedSuggestion.text,
                        imageUrl: ''
                    },
                    ...cards
                ];
                setActiveSession({ ...activeSession, content: serializeBoardContent(nextCards) });
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

    function updateBoardCards(nextCards: IdeaCard[]) {
        if (!activeSession) return;
        setActiveSession({ ...activeSession, content: serializeBoardContent(nextCards) });
    }

    function addCard(type: IdeaCard['type']) {
        const next: IdeaCard = {
            id: crypto.randomUUID(),
            type,
            title: type === 'image' ? 'Image reference' : 'New idea',
            caption: '',
            imageUrl: ''
        };
        updateBoardCards([next, ...boardCards]);
        setExpandedCardId(next.id);
    }

    function updateCard(cardId: string, patch: Partial<IdeaCard>) {
        updateBoardCards(boardCards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)));
    }

    function deleteCard(cardId: string) {
        const nextCards = boardCards.filter((card) => card.id !== cardId);
        updateBoardCards(nextCards.length ? nextCards : starterCards);
        if (expandedCardId === cardId) {
            setExpandedCardId(null);
        }
    }

    function onCardDragStart(event: DragEvent<HTMLElement>, cardId: string) {
        event.dataTransfer.setData('text/plain', cardId);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingCardId(cardId);
    }

    function onTrashDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        const cardId = event.dataTransfer.getData('text/plain');
        if (cardId) {
            deleteCard(cardId);
        }
        setDraggingCardId(null);
    }

    useEffect(() => {
        if (!activeSession || !['brainstorm', 'project-planning'].includes(activeSession.type) || !isAiEnabled || !isAutoPolling) {
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
                    <button className="primary-action" onClick={() => setModalOpen(true)}>+ New</button>
                </div>

                <input
                    className="search-input"
                    placeholder="Search by title/content"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <select className="filter-select" value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                    <option value="all">All types</option>
                    <option value="brainstorm">Brainstorm</option>
                    <option value="project-planning">Project Planning</option>
                    <option value="prompted-brainstorming">Prompted Brainstorming</option>
                    <option value="reading-assistance">Reading Assistance</option>
                </select>

                <div className="session-list">
                    {sessions.map((session) => (
                        <button
                            key={session.id}
                            className={`session-card ${activeSession?.id === session.id ? 'active' : ''}`}
                            onClick={() => openSession(session.id)}
                        >
                            <strong>{session.title}</strong>
                            <span>{session.type}</span>
                            <small>{new Date(session.updated_at).toLocaleString()}</small>
                        </button>
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
                                <button className="primary-action" onClick={saveSession} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                                {activeSession.type === 'project-planning' && (
                                    <button className="primary-action" onClick={generateSpec} disabled={generatingSpec}>
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
                            {activeSession.type === 'reading-assistance' ? (
                                <div className="reading-layout">
                                    <div className="reading-document">
                                        <h3>Document</h3>
                                        <input
                                            placeholder="Paste article or YouTube link"
                                            value={activeSession.goal ?? ''}
                                            onChange={(event) => setActiveSession({ ...activeSession, goal: event.target.value })}
                                        />
                                        <textarea
                                            className="reading-doc-text"
                                            value={activeSession.document_text ?? ''}
                                            onChange={(event) => setActiveSession({ ...activeSession, document_text: event.target.value })}
                                            placeholder="Paste excerpt, article notes, or PDF text here..."
                                        />
                                        <label className="file-upload">
                                            Upload PDF (optional)
                                            <input
                                                type="file"
                                                accept="application/pdf"
                                                onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    if (!file) return;
                                                    const currentText = activeSession.document_text?.trim() ?? '';
                                                    const uploadNote = `Uploaded PDF: ${file.name}`;
                                                    const nextDocumentText = currentText ? `${currentText}\n${uploadNote}` : uploadNote;
                                                    setActiveSession({ ...activeSession, document_text: nextDocumentText });
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="reading-notes">
                                        <h3>Notes</h3>
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
                                            placeholder="Take notes while reading. Highlight text to get simpler explanations."
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="board-controls">
                                        <button className="primary-action" onClick={() => addCard('text')}>+ Note card</button>
                                        <button onClick={() => addCard('image')}>+ Image card</button>
                                        <span>Click a card to expand, edit, or drag it to trash.</span>
                                    </div>
                                    <div className="idea-board">
                                        {boardCards.map((card) => {
                                            const expanded = expandedCardId === card.id;
                                            return (
                                                <article
                                                    key={card.id}
                                                    className={`idea-card ${expanded ? 'expanded' : ''}`}
                                                    draggable
                                                    onDragStart={(event) => onCardDragStart(event, card.id)}
                                                    onDragEnd={() => setDraggingCardId(null)}
                                                    onClick={() => setExpandedCardId(expanded ? null : card.id)}
                                                >
                                                    {card.type === 'image' && card.imageUrl && (
                                                        <img src={card.imageUrl} alt={card.title || 'Idea reference'} />
                                                    )}
                                                    <h4>{card.title || 'Untitled idea'}</h4>
                                                    {!expanded && <p>{card.caption || 'Add context...'}</p>}
                                                    {expanded && (
                                                        <div className="idea-editor" onClick={(event) => event.stopPropagation()}>
                                                            <select
                                                                value={card.type}
                                                                onChange={(event) => updateCard(card.id, { type: event.target.value as IdeaCard['type'] })}
                                                            >
                                                                <option value="text">Text card</option>
                                                                <option value="image">Image card</option>
                                                            </select>
                                                            <input
                                                                value={card.title}
                                                                placeholder="Card title"
                                                                onChange={(event) => updateCard(card.id, { title: event.target.value })}
                                                            />
                                                            {card.type === 'image' && (
                                                                <input
                                                                    value={card.imageUrl}
                                                                    placeholder="Paste image URL"
                                                                    onChange={(event) => updateCard(card.id, { imageUrl: event.target.value })}
                                                                />
                                                            )}
                                                            <textarea
                                                                value={card.caption}
                                                                placeholder="AI caption or your own notes"
                                                                onChange={(event) => updateCard(card.id, { caption: event.target.value })}
                                                            />
                                                            <div className="actions">
                                                                <button className="danger" onClick={() => deleteCard(card.id)}>Delete</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                    <div
                                        className={`trash-dropzone ${draggingCardId ? 'active' : ''}`}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={onTrashDrop}
                                    >
                                        🗑 Drag card here to delete
                                    </div>
                                </>
                            )}
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
                                className="primary-action"
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
                                    ? 'Suggestions auto-refresh while you type in brainstorming and project-planning modes.'
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

            <NewSessionModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onCreate={createSession}
                brainstormSessions={sessions.filter((session) => session.type === 'brainstorm')}
            />
        </div>
    );
}

export default App;
