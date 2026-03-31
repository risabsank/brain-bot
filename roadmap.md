# AI-Assisted Ideation Project Roadmap

## 1) Objective
Deliver an MVP web app that supports three ideation workflows (Brainstorm, Project Planning, Prompted Brainstorming) with proactive AI assistance, session history/search, and PDF exports.

---

## 2) Guiding Outcomes
By MVP launch, users should be able to:
1. Start a session by selecting one of 3 modes.
2. Receive useful AI suggestions without constant manual prompting.
3. Re-open, edit, search, and filter past sessions.
4. Export each session into a polished, mode-specific PDF artifact.

---

## 3) Timeline (12 Weeks)

## Phase 0 — Discovery & Technical Design (Week 1)
### Deliverables
- Product requirements finalization (based on `scope.md`).
- UX wireframes for all 3 modes.
- Architecture decision record (frontend, backend, storage, LLM provider, PDF stack).
- Metrics definition and event taxonomy.

### Exit Criteria
- Approved designs + technical plan.
- Backlog with prioritized MVP stories.

---

## Phase 1 — Platform Foundations (Weeks 2–3)
### Build
- Authentication and user workspace shell.
- Session CRUD APIs + persistence.
- Session metadata model (title, type, dates, tags).
- Editor shell with autosave + manual save.

### Exit Criteria
- Users can create/open/edit/delete sessions reliably.
- No text loss on refresh/navigation.

---

## Phase 2 — AI Copilot Core (Weeks 4–5)
### Build
- Save-triggered AI pipeline.
- Suggestion taxonomy: extension, critique, alternatives, summarize, rewrite.
- Suggestion UI in right sidebar.
- Accept/dismiss/insert interactions.

### Exit Criteria
- Save action produces contextual AI suggestions.
- Suggestion actions correctly mutate session content.
- Latency and failure states are visible and handled.

---

## Phase 3 — Mode-Specific Workflows (Weeks 6–7)
### Build
- **Brainstorm** mode prompts and output formatting.
- **Project Planning** structured sections + guided prompts.
- **Prompted Brainstorming** document upload + extraction + contextual prompting.

### Exit Criteria
- All 3 modes have tailored UX and AI behavior.
- Prompted Brainstorming can process at least one supported file format end-to-end.

---

## Phase 4 — History, Search, and Filters (Week 8)
### Build
- Sessions list page with search (title/content).
- Filters by mode/date; sort by created/updated/title.
- Basic tag support (optional for MVP if time permits).

### Exit Criteria
- Users can reliably find older sessions by type/date/name.

---

## Phase 5 — PDF Export and Templates (Week 9)
### Build
- Export service and template system.
- 3 export templates:
  - Brainstorm Summary
  - Project Scope/Roadmap
  - Prompted Brainstorming Report/Roadmap

### Exit Criteria
- Users can export every session mode as downloadable PDF.
- PDFs contain session metadata and finalized content.

---

## Phase 6 — Quality, Guardrails, and Hardening (Weeks 10–11)
### Build
- Error handling + retries for AI calls.
- Token/cost guardrails and prompt budget controls.
- Accessibility pass (keyboard support, semantic labels, contrast).
- Performance tuning for save/AI response loops.

### Exit Criteria
- Critical-path flows pass QA.
- Baseline accessibility and reliability targets met.

---

## Phase 7 — Launch Readiness (Week 12)
### Build
- Beta onboarding copy and empty states.
- Analytics dashboards for MVP metrics.
- Production checklist (monitoring, backups, incident runbook).

### Exit Criteria
- Go/no-go review complete.
- MVP released to pilot users.

---

## 4) Workstreams and Ownership (Suggested)

- **Product/Design**: Session flow UX, mode-specific guidance, acceptance criteria.
- **Frontend**: Editor, suggestion UI, history/search/filter, export triggers.
- **Backend**: Session APIs, persistence, AI orchestration, export generation.
- **AI/Prompting**: Prompt templates, suggestion quality, challenge behaviors, evaluations.
- **QA**: Functional regression, accessibility validation, reliability testing.

---

## 5) MVP Backlog by Priority

## P0 (Must Have)
- Session type selection at new-session start.
- Session CRUD + autosave/manual save.
- Save-triggered AI suggestions.
- Accept/dismiss suggestion interactions.
- History page with search/filter by mode/date/name.
- PDF export for all 3 session types.

## P1 (Should Have)
- Inline suggestion bubbles in editor.
- Prompted Brainstorming multi-format file support.
- Version snapshots for rollback.

## P2 (Could Have)
- Tags and advanced filtering.
- Additional export themes/branding.
- Team sharing and collaboration primitives.

---

## 6) Risks and Mitigations

1. **AI quality inconsistency**
   - Mitigation: human-in-the-loop controls, suggestion categories, eval prompts, continuous tuning.

2. **Latency and cost drift**
   - Mitigation: rate limits, token budgets, caching summaries, async generation.

3. **Document parsing variability**
   - Mitigation: strict supported-format list for MVP and fallback extraction handling.

4. **Feature creep during MVP**
   - Mitigation: enforce P0/P1/P2 boundaries and weekly scope reviews.

---

## 7) Success Metrics (MVP)
- Session completion rate by mode.
- AI suggestion acceptance rate.
- Time from first input to export.
- 7-day return rate.
- Export rate per completed session.
- User-rated usefulness of AI suggestions.

---

## 8) First Sprint Plan (Week 1–2)

### Sprint Goal
Stand up foundational app shell and session lifecycle.

### Stories
- Implement auth and workspace shell.
- Create session model + migrations.
- Build create/open/edit/delete session APIs.
- Add basic editor with autosave.
- Implement new-session mode selector UI.

### Definition of Done
- End-to-end demo: create session → type notes → autosave persists → reopen content.

