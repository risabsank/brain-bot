# AI-Assisted Ideation Project Scope

## 1) Project Overview

Build a web application that helps users move from raw ideas to actionable plans using an AI collaborator. The app supports three session types:

1. **Brainstorm (Open)**
2. **Project Planning (Directed toward scope/roadmap)**
3. **Prompted Brainstorming (Document-informed, directed output)**

The product should feel friendly, low-friction, and proactive: users can type/save thoughts naturally while the AI offers timely suggestions, critiques, and alternate directions without requiring constant manual prompting.

---

## 2) Goals and Non-Goals

### Goals
- Provide differentiated workflows for all three ideation modes.
- Generate meaningful AI assistance that is **situated** to user context.
- Support iterative thinking with session history, editability, and search/filter.
- Enable downloadable PDF outputs tailored to each session type.
- Encourage better decisions by having the AI challenge assumptions and propose alternatives.

### Non-Goals (v1)
- Real-time multi-user collaboration on the same session.
- Deep enterprise integrations (Jira/Confluence/Notion) in initial release.
- Complex permissions hierarchy beyond single-user account ownership.

---

## 3) Core User Experience

### 3.1 Session Creation Flow
When a user starts a new session, they must choose:
- **Brainstorm**
- **Project Planning**
- **Prompted Brainstorming**

After selection, the app launches a tailored workspace with specific starter prompts, UI hints, and expected outputs.

### 3.2 Session-Type Behaviors

#### A) Brainstorm (Open)
**User intent:** Explore broad ideas quickly.

**UX behavior:**
- Lightweight text-first canvas for freeform thoughts.
- Save events trigger AI to provide:
  - idea expansions,
  - related opportunities,
  - risks/gaps,
  - “what if” provocations.
- AI suggests 3 optional pathways for each major idea.
- Export PDF summary of ideas and suggested next steps.

#### B) Project Planning (Directed)
**User intent:** Produce a scope/roadmap from ideas.

**UX behavior:**
- Guided planning structure (problem, goals, users, constraints, milestones).
- AI prompts toward clarity and decision-making.
- Save events trigger plan refinement and missing-section detection.
- Export PDF scope/roadmap (phases, deliverables, risks, assumptions).

#### C) Prompted Brainstorming (Document + Goal)
**User intent:** React to literature/report/context with a specific objective.

**UX behavior:**
- User uploads/provides a document and defines an outcome goal.
- AI helps interpret key insights and implications.
- AI proposes strategic responses (e.g., pivot options, response memo outline).
- Export PDF as either roadmap or report depending on selected output mode.

### 3.3 AI Interaction Model
- AI should be **proactive but non-intrusive**.
- User should not always need to type a prompt; save actions and context changes can trigger AI updates.
- AI outputs include:
  - situated summaries,
  - provocations/challenges,
  - text rewrites/manipulations,
  - multi-option recommendations (default: 3 options).

### 3.4 AI Presentation Patterns
Support one or both interaction patterns:
- **Right sidebar assistant** with live suggestions.
- **Inline suggestion bubbles** attached to user text blocks.

Users can accept, dismiss, or expand suggestions.

---

## 4) Functional Requirements

### 4.1 Session Management
- Create, open, edit, duplicate, archive, and delete sessions.
- Persist all sessions with metadata:
  - name/title,
  - session type,
  - created/updated timestamps,
  - optional tags.
- Browse history and return to prior sessions.

### 4.2 Search and Filtering
- Search sessions by title/content.
- Filter by session type.
- Filter by date range.
- Sort by last updated, created date, or alphabetical.

### 4.3 Editing and Version Safety
- Editable content for all sessions.
- Autosave and manual save.
- Version snapshots (at least lightweight timeline in v1.1 if not v1).

### 4.4 AI Suggestions and Challenges
- Trigger conditions:
  - on save,
  - after significant text changes,
  - user-invoked “refresh ideas” action.
- Suggestion categories:
  - extension,
  - challenge/critique,
  - alternative strategy,
  - summarization,
  - rewrite/tighten language.
- Each suggestion should be actionable: accept/insert, edit before insert, dismiss.

### 4.5 Document-Aware Reasoning (Prompted Brainstorming)
- Upload support (PDF/doc/txt in v1 depending on implementation constraints).
- Extract and chunk document text.
- AI responses cite/refer to document sections where feasible.

### 4.6 PDF Export
- Session-specific templates:
  - Brainstorm Summary,
  - Project Scope/Roadmap,
  - Strategic Report/Roadmap from Prompted Brainstorming.
- Include session title, date, key outputs, and AI-assisted insights.

---

## 5) Non-Functional Requirements

### 5.1 UX and Accessibility
- Friendly, simple, low cognitive load interface.
- Responsive layout (desktop first, workable tablet).
- Accessibility baseline: keyboard navigation, proper semantic labels, color contrast.

### 5.2 Performance
- Fast autosave feedback (<1 second perceived response where possible).
- AI suggestion generation should show progress indicators.

### 5.3 Reliability and Data Integrity
- No loss of user text on refresh/network hiccups.
- Retry behavior for failed AI calls.

### 5.4 Privacy and Security
- Secure user data storage.
- Clear handling for uploaded documents.
- Basic audit trail for session modifications.

---

## 6) Recommended Data Model (v1)

### Entities
- **User**
- **Session**
  - id, user_id, title, type, status, created_at, updated_at
- **SessionEntry**
  - session_id, content, position/order, created_at
- **AISuggestion**
  - session_id, target_entry_id (optional), category, suggestion_text, state(accepted/dismissed/pending), created_at
- **Attachment** (for prompted brainstorming)
  - session_id, file_name, mime_type, storage_path, extracted_text_ref
- **Export**
  - session_id, export_type, file_path, created_at

---

## 7) Key User Stories

1. As a user, I can start a new ideation session by choosing one of the three session types.
2. As a user, I can write ideas freely and get AI expansions/challenges when I save.
3. As a user, I can run a directed planning flow that outputs a practical scope/roadmap.
4. As a user, I can upload a relevant document and receive goal-oriented strategy suggestions.
5. As a user, I can view, edit, search, and filter previous sessions.
6. As a user, I can export a polished PDF artifact from any session type.
7. As a user, I can accept or dismiss AI suggestions so I stay in control.

---

## 8) Acceptance Criteria (MVP)

- New session flow enforces session type selection.
- Each session type loads unique prompt guidance and output expectations.
- Save action reliably triggers contextual AI suggestions.
- AI provides at least three structured options for major idea updates.
- Session history is persisted and searchable/filterable by type/date/name.
- PDFs generate successfully for all three session modes.
- Users can edit prior sessions and continue where they left off.

---

## 9) MVP Delivery Plan

### Phase 1 — Foundations
- Auth + user workspace
- Session CRUD + metadata
- Basic editor + autosave/manual save

### Phase 2 — AI Copilot Core
- Save-triggered AI suggestions
- Sidebar suggestion UI
- Accept/dismiss actions

### Phase 3 — Mode Specialization
- Distinct workflows/prompts per session type
- Project-planning structured sections
- Prompted-brainstorming document ingestion

### Phase 4 — History + Export
- Search/filter/sort session archive
- PDF templating per mode

### Phase 5 — Polish
- Inline suggestion bubbles
- UX refinements and quality improvements

---

## 10) Open Questions / Gaps to Resolve

1. **LLM policy:** Which model(s), token limits, and cost controls?
2. **Trigger tuning:** How often should proactive AI run to avoid overload?
3. **Document scale:** Maximum upload size and supported formats for v1?
4. **Versioning depth:** Full version history vs. periodic snapshots in MVP?
5. **PDF fidelity:** Should exports include branding/custom themes?
6. **Collaboration roadmap:** Is shared workspace needed in v1.1/v2?
7. **Metrics:** What success metrics define “better ideation” (e.g., completion rate, export rate, suggestion acceptance rate)?

---

## 11) Suggested Success Metrics

- Session completion rate by type.
- Percentage of sessions with accepted AI suggestions.
- Time from first note to export.
- Repeat usage (weekly active users creating new sessions).
- User satisfaction score on suggestion usefulness.

---

## 12) Summary

This project will deliver a structured but flexible AI ideation platform with three distinct workflows, proactive AI assistance, strong session memory/searchability, and tangible outputs via PDF exports. The design principle is **user-led thinking with AI as an active, challenging collaborator**.
