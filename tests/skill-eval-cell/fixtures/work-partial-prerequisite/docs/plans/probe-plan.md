---
execution: code
---

# Private integration probe

## Goal Capsule

Prove the private integration through an executable probe before building the dashboard. Local preparation is ready; hosted verification needs credentials and separate deployment approval.

## Product Contract

The probe exposes only a readiness check using synthetic data. A local check does not establish hosted compatibility or pass the live gate. Do not build the dashboard before that gate passes.

## Planning Contract

Use Node's built-in HTTP server and test runner. The server binds only to loopback. No external dependencies or services are needed for local preparation. Hosting credentials and deployment approval are not available.

## Implementation Units

### U1. Prepare and prove the integration probe

**Dependencies:** No production units. Prepare the executable deployment and local checks before requesting deployment approval. Live verification requires credentials and approval.

**Files:** `spikes/probe/package.json`, `spikes/probe/server.js`, `spikes/probe/contract.test.js`, `docs/proof.md`.

**Approach:** Create a Node HTTP server exposing `GET /health` with status 200 and JSON `{"ready":true}`. Other requests return 404. Allow an ephemeral local port for verification. Document how to start it and reproduce the local checks. After approval, deploy and verify the actual hosted endpoint; record that evidence separately.

**Verification:** Real HTTP requests check readiness and the 404 case using `node --test`. Record the commands and results. U1 remains incomplete until the live observation exists.

### U2. Build the dashboard

**Dependencies:** U1's observed live proof, not just its local tests.

**Files:** `src/dashboard.js`.

**Approach:** Only after the live gate passes, build a dashboard using the verified integration.

## Verification Contract

Local: the probe starts and real HTTP tests pass. Live: the hosted endpoint is observed after credentials and deployment approval become available. Keep these outcomes distinct.

## Definition of Done

Both the local executable probe and the live proof exist, followed by the dependent dashboard. Otherwise report the completed preparation, blocked actions, missing inputs, and recovery path without claiming U1 or the project complete.
