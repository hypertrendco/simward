# SimWard — virtual clinical simulation platform

AI-driven, 3D, scenario-based simulation for building nursing students' clinical judgment. Modeled on the vSim / Laerdal workflow: **pre-brief (SBAR hand-off) → bedside simulation → debrief**.

## Roles
- **Admin** — users & roles, cohorts, competency framework, AI settings, passing standard, audit log, program analytics.
- **Instructor** — drag-and-drop scenario builder (3D room, patient, states & transitions, scoring, EHR, debrief), AI scenario drafting, assignments, competency heatmap, per-student AI remediation plans, attempt review.
- **Student** — assigned & practice scenarios, 3D simulation (click-to-assess patient regions, action menu, MAR with med-rights checks, EHR, AI patient chat, SBAR calls, nursing notes), scored debrief with AI feedback, reflection, competency profile.

## Architecture
- `server/` Express + Railway Postgres (JWT cookie auth, role checks on every route, server-authoritative scoring, audit log, Anthropic proxy with rate limiting).
- `src/` Preact + three.js SPA bundled by esbuild into `public/`.
  - `sim/engine.js` — Laerdal-style state machine (states, trends, handlers) + physiology offsets; bounded AI "director".
  - `sim/scoring.js` — expected/critical/timed/ordered actions, harmful actions, med-rights, per-competency roll-up (QSEN + NCSBN CJMM).
  - `three/` — procedural clinical rooms, 25 equipment types, physiology-driven patient (breathing, cyanosis, pallor, diaphoresis, LOC).
  - `ai/` — prompts for patient dialogue, director, debrief (PEARLS/CJMM), remediation, scenario drafting; rule-based fallbacks for all.

## Environment variables
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Railway reference `${{Postgres.DATABASE_URL}}`) |
| `JWT_SECRET` | session signing secret |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first-boot admin account |
| `DEMO_PASSWORD` | password for seeded demo instructor/students (`SEED_DEMO=false` to skip demo data) |
| `ANTHROPIC_API_KEY` | enables AI patient, director, debrief, remediation, scenario drafting |
| `ANTHROPIC_MODEL` | optional model override |

## Run locally
```
npm install && npm run build && DATABASE_URL=postgres://... npm start
```

Open-source references: Laerdal SimDesigner/LLEAP state–trend–handler model; Kitware Pulse Physiology Engine and BioGears (conceptual basis for the trend-based physiology layer); INACSL Healthcare Simulation Standards and PEARLS debriefing.
