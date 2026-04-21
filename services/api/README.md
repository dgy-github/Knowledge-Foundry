# Backend Workspace

## Ownership
- Agent: Backend
- Scope: `services/api`

## Runtime Surface
- `server.mjs` exposes a real `GET /health` endpoint on `127.0.0.1:3210` by default.
- The service also exposes `GET /sources`, `GET /wiki/pages`, `GET /outputs`, `GET /jobs`, and `GET /search`.
- It supports `POST /jobs/compile`, `POST /jobs/query`, and `POST /jobs/health-check` for the first MVP workflows.
- The payload matches the contract in `specs/api-contract.yaml`: health, workspace counts, and file-backed knowledge-base job surfaces.
- Acceptance snapshot: # Acceptance ## Goal - Make `npm run orchestrate` succeed. - Keep the repository as a minimal runnable skeleton with clear handoffs. ## Constraints - Preserve Planner -> Architect -> Frontend -> Backend -> QA -> Revie...
- Architecture snapshot: # Architecture ## Context - The orchestrator is the product under test. - Agent prompts in `agents/` define responsibilities and ownership. - Specs in `specs/` are the shared handoff surface between roles. - Stack: we...

## Local Run
- Run `npm run api:start`.

## Delivery
- Keep the implementation minimal and dependency-free.
- Preserve the contract so QA and downstream consumers can rely on a real endpoint during smoke tests.
- Keep the knowledge workspace file-backed and inspectable on disk.
