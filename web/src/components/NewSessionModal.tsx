import { useState, type FormEvent } from 'react';
import type { SessionType } from '../lib/api';

const modeHelper: Record<SessionType, string> = {
    brainstorm: 'Explore ideas freely with AI provocations and pathways.',
    'project-planning': 'Build a guided scope + roadmap with milestones and risks.',
    'prompted-brainstorming': 'Use a source document + goal for strategic options.'
};

interface Props {
    open: boolean;
    onClose: () => void;
    onCreate: (payload: { title: string; type: SessionType; goal?: string; documentText?: string }) => Promise<void>;
}

export function NewSessionModal({ open, onClose, onCreate }: Props) {
    const [sessionType, setSessionType] = useState<SessionType>('brainstorm');
    if (!open) return null;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const type = form.get('type') as SessionType;

        await onCreate({
            title: String(form.get('title')),
            type,
            goal: String(form.get('goal') || ''),
            documentText: String(form.get('documentText') || '')
        });
    }

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <form className="modal" onSubmit={handleSubmit}>
                <h2>Create new ideation session</h2>
                <label>
                    Title
                    <input required name="title" placeholder="Ex: Community tool for creators" />
                </label>

                <label>
                    Session type
                    <select name="type" value={sessionType} onChange={(event) => setSessionType(event.target.value as SessionType)}>
                        <option value="brainstorm">Brainstorm</option>
                        <option value="project-planning">Project Planning</option>
                        <option value="prompted-brainstorming">Prompted Brainstorming</option>
                    </select>
                </label>

                <label>
                    Goal (optional)
                    {sessionType === 'project-planning' ? 'Planning prompt' : 'Goal (optional)'}
                    <input
                        name="goal"
                        required={sessionType === 'project-planning'}
                        placeholder={
                            sessionType === 'project-planning'
                                ? 'What kind of plan are you trying to create?'
                                : 'What are you trying to achieve?'
                        }
                    />
                </label>

                <label>
                    Document text / excerpt (optional)
                    <textarea name="documentText" rows={4} placeholder="Paste a short excerpt for document-informed brainstorming." />
                </label>

                <p className="helper">Tip: {modeHelper[sessionType]}</p>

                <div className="actions">
                    <button type="button" onClick={onClose} className="ghost">
                        Cancel
                    </button>
                    <button type="submit">Create Session</button>
                </div>
            </form>
        </div>
    );
}
