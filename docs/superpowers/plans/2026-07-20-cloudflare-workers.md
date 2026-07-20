# Cloudflare Workers Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run ZestSend on Cloudflare Workers without an external Redis service while preserving its existing room, signaling, IP metadata, and P2P UI behavior.

**Architecture:** Keep the existing Next.js Pages Router application and REST endpoints, package it for Workers with the official OpenNext adapter, and replace the TCP Redis repository with one SQLite-backed Durable Object per room. API routes call the Durable Object through an internal binding; room initialization and peer registration become single serialized operations so two concurrent clients cannot overfill or recreate a room.

**Tech Stack:** Next.js 14, React 18, OpenNext for Cloudflare, Wrangler, Cloudflare Workers, SQLite-backed Durable Objects, Node.js built-in test runner.

---

## File map

- Create `tests/room-state-core.test.mjs`: executable behavioral contract for room initialization, peer registration, IP metadata, signaling queues, and expiry.
- Create `worker/room-state-core.mjs`: pure state transition functions shared by the Durable Object and tests.
- Create `worker/room-state.mjs`: Durable Object storage and JSON operation dispatcher.
- Create `worker/index.mjs`: custom Worker entrypoint that exposes both OpenNext and the Durable Object class.
- Rewrite `lib/redis.js`: preserve existing exports while routing state operations through the `ROOM_STATE` binding; add atomic `initializeRoom` and `registerPeer` operations.
- Modify `pages/api/room/init.js`: use atomic room initialization.
- Modify `pages/api/signaling/register.js`: use atomic peer registration.
- Create `open-next.config.mjs`, `wrangler.jsonc`, and `public/_headers`: OpenNext build and Workers bindings/caching configuration.
- Modify `package.json` and `.gitignore`: add Cloudflare scripts/dependencies and ignore generated output.
- Modify `README.md`: document local preview and Cloudflare deployment.

### Task 1: State transition contract

**Files:**
- Create: `tests/room-state-core.test.mjs`
- Create: `worker/room-state-core.mjs`

- [ ] **Step 1: Write failing room initialization tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { initializeRoom } from "../worker/room-state-core.mjs";

test("first client creates a room and becomes initiator", () => {
  const result = initializeRoom(null, "203.0.113.1", "2026-07-20T00:00:00.000Z");
  assert.equal(result.isInitiator, true);
  assert.equal(result.room.peers.length, 1);
});

test("a third unique client cannot join a two-person room", () => {
  const room = { createdAt: "now", peers: [{ ip: "a" }, { ip: "b" }] };
  assert.equal(initializeRoom(room, "c", "later").roomFull, true);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/room-state-core.test.mjs`

Expected: FAIL because `worker/room-state-core.mjs` does not exist.

- [ ] **Step 3: Add minimal pure transitions**

```js
export function initializeRoom(room, clientIP, now) {
  if (!room) return { room: { createdAt: now, peers: [{ ip: clientIP, joinedAt: now }] }, isInitiator: true, roomFull: false };
  if (!room.peers.some((peer) => peer.ip === clientIP) && room.peers.length >= 2) return { room, isInitiator: false, roomFull: true };
  const peers = room.peers.some((peer) => peer.ip === clientIP) ? room.peers : [...room.peers, { ip: clientIP, joinedAt: now }];
  return { room: { ...room, peers }, isInitiator: false, roomFull: false };
}
```

- [ ] **Step 4: Add tests and implementations for peer registration, signal dequeue, IP metadata, and TTL filtering**

Use pure functions named `registerPeerInRoom`, `appendSignal`, `takeLiveSignals`, and `isExpired`; cover same-IP replacement, duplicate peer IDs, one-time signal delivery, and one-/three-hour expiry boundaries.

- [ ] **Step 5: Run the full contract and verify GREEN**

Run: `node --test tests/room-state-core.test.mjs`

Expected: all tests pass with zero failures.

### Task 2: Durable Object and repository adapter

**Files:**
- Create: `worker/room-state.mjs`
- Rewrite: `lib/redis.js`
- Modify: `pages/api/room/init.js`
- Modify: `pages/api/signaling/register.js`

- [ ] **Step 1: Implement the Durable Object operation dispatcher**

`RoomState.fetch()` accepts `{ operation, payload }`, serially loads/stores `room`, `signals:<peerId>`, and `ip:<peerId>` keys, and returns JSON. It sets a three-hour alarm and deletes all storage on alarm.

- [ ] **Step 2: Replace the Redis client with binding calls**

```js
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function callRoomState(roomId, operation, payload = {}) {
  const { env } = getCloudflareContext();
  const stub = env.ROOM_STATE.get(env.ROOM_STATE.idFromName(roomId));
  const response = await stub.fetch("https://room-state.internal/", {
    method: "POST",
    body: JSON.stringify({ operation, payload }),
  });
  if (!response.ok) throw new Error(`Room state operation failed: ${response.status}`);
  return response.json();
}
```

- [ ] **Step 3: Make room initialization and registration atomic**

Update the two API handlers to call `initializeRoom(roomId, clientIP)` and `registerPeer(roomId, peerId, isInitiator, clientIP)` exactly once per request, while preserving their response status and JSON fields.

- [ ] **Step 4: Re-run state tests**

Run: `node --test tests/room-state-core.test.mjs`

Expected: all tests pass.

### Task 3: OpenNext and Wrangler packaging

**Files:**
- Create: `worker/index.mjs`
- Create: `open-next.config.mjs`
- Create: `wrangler.jsonc`
- Create: `public/_headers`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add the custom Worker entrypoint**

```js
import handler from "../.open-next/worker.js";
export { RoomState } from "./room-state.mjs";
export default { fetch: handler.fetch };
```

- [ ] **Step 2: Configure the Durable Object binding and SQLite migration**

`wrangler.jsonc` uses `worker/index.mjs`, `nodejs_compat`, `.open-next/assets`, a `ROOM_STATE` Durable Object binding, and migration `v1` with `new_sqlite_classes: ["RoomState"]`.

- [ ] **Step 3: Add Cloudflare build scripts and dependencies**

Add `cf:build`, `preview`, `deploy`, and `upload` scripts. Add current compatible releases of `@opennextjs/cloudflare` and `wrangler`; remove unused `ioredis` and `redis` packages after the repository adapter no longer imports them.

- [ ] **Step 4: Install dependencies and build**

Run: `npm install`

Run: `npm run cf:build`

Expected: Next.js and OpenNext both finish successfully and Wrangler reports a bundle below the account's Worker size limit.

- [ ] **Step 5: Preview and smoke-test locally**

Run: `npm run preview`

Check `/`, `/api/room/check?roomId=1234`, `/api/room/init?roomId=1234`, and peer registration/polling responses with `curl`.

### Task 4: Documentation, deployment, and production verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Cloudflare deployment**

Add exact `npm install`, `npm run preview`, `npm run deploy`, optional `TURN_ID`/`TURN_TOKEN`, and Durable Object notes. Remove the claim that Redis is required for the Cloudflare build.

- [ ] **Step 2: Deploy through the authenticated Cloudflare account**

Use the Cloudflare dashboard/authorized Wrangler login to create the Worker, apply Durable Object migration `v1`, and obtain the `workers.dev` URL.

- [ ] **Step 3: Run production smoke tests**

Request the homepage and room APIs from the deployed URL. Open two isolated browser tabs, join the same four-digit room, and verify both peers are visible without 5xx responses.

- [ ] **Step 4: Review repository changes and final evidence**

Run: `git diff --check && git status --short && npm test && npm run cf:build`

Expected: no whitespace errors, only intentional files changed, all tests pass, and a fresh Cloudflare build succeeds.

## Self-review

- Spec coverage: Workers deployment, Next.js runtime packaging, Redis replacement, state correctness, local validation, authenticated deployment, and online validation are all mapped to tasks.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation placeholders remain.
- Type consistency: the binding is consistently named `ROOM_STATE`; the Durable Object class is consistently named `RoomState`; API adapter names match the planned handler calls.
