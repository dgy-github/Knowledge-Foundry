# Frontend Workspace

## Ownership
- Agent: Frontend
- Scope: `apps/web`

## Runtime Surface
- `index.html` and `main.js` render a knowledge workspace dashboard.
- The page calls the local API to list raw sources, wiki pages, outputs, jobs, and search results.
- The page can trigger compile, query, and health-check jobs against the local workspace.
- Acceptance snapshot: # Acceptance ## Goal - Make `npm run orchestrate` succeed. - Keep the repository as a minimal runnable skeleton with clear handoffs. ## Constraints - Preserve Planner -> Architect -> Frontend -> Backend -> QA -> Revie...
- Architecture snapshot: # Architecture ## Context - The orchestrator is the product under test. - Agent prompts in `agents/` define responsibilities and ownership. - Specs in `specs/` are the shared handoff surface between roles. - Stack: we...

## Local Run
- Start the API with `npm run api:start`.
- Start the preview server with `npm run web:preview`.
- Open `http://127.0.0.1:4173`.

## Delivery
- Keep the frontend minimal but pointed at a real endpoint.
- Use the backend contract fields as the single source of truth for what is displayed.
- Make the MVP useful as a browser and control panel for the markdown knowledge workspace.
