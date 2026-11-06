# DGMS-Copilot Platform

Enterprise-style mining compliance assistant for Central Coalfields Limited workflows. The platform provides DGMS search, citation-backed compliance assistance, controlled knowledge repository management, operational report analysis, traceability, governance controls, and a system architecture view.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-inspired local components
- Framer Motion
- Lucide icons

## Run Locally

### 1. Prerequisites
- [Install Ollama](https://ollama.com/download)
- Pull the required models (once):
  ```bash
  ollama pull qwen3:8b
  ollama pull llama3.1:8b
  ```

### 2. Startup
```bash
git clone <repository-url>
cd dgms-copilot
npm install
npm run dev
```

`npm run dev` will automatically orchestrate:
1. Detecting/launching Ollama locally
2. Starting the FastAPI backend (port 8000)
3. Starting the Next.js frontend (port 3000)

Open `http://localhost:3000`.

## Application Areas

1. Login page: role-based platform entry.
2. Dashboard: Compliance Operations Center.
3. DGMS Search: semantic search over circulars, SOPs, and inspection notes.
4. Assistant: compliance chat with citations.
5. Knowledge Repository: document inventory and approval status.
6. Traceability: clause-level citation validation.
7. Operational Report Analysis: safety observations and recommended closure actions.
8. System Architecture: document ingestion to assistant retrieval flow.
9. Governance: access, ingestion, and audit controls.
