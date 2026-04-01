# Brain Bot (AI-Assisted Ideation Workspace)

A full-stack TypeScript app for ideation sessions with 3 modes:

- **Brainstorm** (open exploration)
- **Project Planning** (guided scope/roadmap)
- **Prompted Brainstorming** (document + goal driven)

It includes session history/search/filtering, AI suggestion sidebar (with graceful unavailable messaging), and PDF export per session.

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database (SQL):** SQLite via Node built-in `node:sqlite` (no native npm addon)
- **PDF Export:** PDFKit
- **AI/LLM:** Optional OpenAI-compatible Chat Completions API

---

## 1) Prerequisites

- Node.js 22+ (recommended: 22 LTS or 24)
- npm 10+

---

## 2) Install dependencies

From project root:

```bash
npm install
npm run install:all
```

---

## Install note (fix for `better-sqlite3` build errors)

This project intentionally **does not** use `better-sqlite3` anymore.
If you previously saw `node-gyp`/`distutils` errors on macOS + Node 24, pull latest changes and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## 3) SQL setup (SQLite)

No separate DB server is required.

1. Copy env file:

```bash
cp .env.example server/.env
```

2. Start backend once:

```bash
npm run dev --workspace server
```

On first start, the app auto-creates `brainbot.db` and required SQL tables:

- `sessions`
- `suggestions`

Stop with `Ctrl+C`.

---

## 4) AI/LLM integration setup

AI is optional and integrated in the backend (`server/.env`).

Edit `server/.env`:

```env
PORT=4000
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

### If AI is not configured or unavailable

The app will show:

> AI tool unavailable. You can continue using this app as a brainstorming workspace without AI suggestions.

This is intentional (no deterministic fallback logic).

---

## 5) Run the application

### Run both frontend + backend

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

### Run separately

Backend:

```bash
npm run dev --workspace server
```

Frontend:

```bash
npm run dev --workspace web
```

---

## 6) How to use

1. Click **+ New** to create a session.
2. Choose one of 3 session types.
3. Write ideas in the editor.
4. Click **Save + Refresh AI** to store updates and generate suggestions.
5. Accept/dismiss suggestions from the right-side copilot panel.
6. Use sidebar search/filter to revisit old sessions.
7. Click **Export PDF** to download session output.

---

## 7) Build for production

```bash
npm run build
```

Then run backend build:

```bash
npm run start --workspace server
```

Serve `web/dist` with any static hosting (or reverse proxy).

---

## 8) MVP coverage against scope/roadmap

Implemented:

- Mode selection with tailored UX hints
- Session CRUD + persistence
- Save-triggered AI generation flow
- Accept/dismiss suggestion controls
- Session search/filter by type + text
- Mode-aware workspace support for goal/document context
- PDF export endpoint
- Modern, simplified TypeScript UI

