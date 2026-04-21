# Architecture

## Context
- The orchestrator is the product under test.
- Agent prompts in `agents/` define responsibilities and ownership.
- Specs in `specs/` are the shared handoff surface between roles.
- Stack: web-api

## Flow
1. Planner refreshes acceptance and captures QA feedback.
2. Architect refreshes architecture and API contract from the current plan.
3. Backend exposes a minimal runtime `GET /health` surface.
4. Backend enriches `GET /health` with the latest orchestration report summary.
5. Frontend consumes the runtime surface from a minimal page and local preview server.
6. QA validates the repository by running the required npm commands.
7. Reviewer summarizes readiness, findings, and residual risk.

## Local Fallback Strategy
- When credentials are unavailable, the orchestrator still reads each agent prompt and shared context.
- The fallback runner writes deterministic artifacts that mirror the expected handoff for each role.
- QA remains the source of truth for pass/fail and gates the review step.

## Current Acceptance Snapshot
- # Acceptance ## Goal - Make `npm run orchestrate` succeed. - Keep the repository as a minimal runnable skeleton with clear handoffs. ## Constraints - Preserve Planner -> Architect -> Frontend -> Backend -> QA -> Revie...
