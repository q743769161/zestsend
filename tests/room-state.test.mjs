import assert from "node:assert/strict";
import test from "node:test";

import { RoomState } from "../worker/room-state.mjs";
import { SIGNAL_TTL_MS } from "../worker/room-state-core.mjs";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarm = null;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async delete(key) {
    return this.values.delete(key);
  }

  async deleteAll() {
    this.values.clear();
  }

  async setAlarm(timestamp) {
    this.alarm = timestamp;
  }
}

function createRoomState(now = 1_000) {
  const storage = new MemoryStorage();
  const object = new RoomState({ storage }, {}, () => now);
  return { object, storage };
}

async function call(object, operation, payload = {}) {
  const response = await object.fetch(new Request("https://room-state.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation, payload }),
  }));

  return { response, body: await response.json() };
}

test("room initialization persists state and refreshes its alarm", async () => {
  const { object, storage } = createRoomState();

  const initialized = await call(object, "initializeRoom", {
    clientIP: "203.0.113.1",
    joinedAt: "2026-07-20T00:00:00.000Z",
  });
  const loaded = await call(object, "getRoom");

  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.body.isInitiator, true);
  assert.deepEqual(loaded.body.room, initialized.body.room);
  assert.ok(storage.alarm > 1_000);
});

test("room initialization serially rejects a third unique client", async () => {
  const { object } = createRoomState();

  await call(object, "initializeRoom", { clientIP: "a", joinedAt: "one" });
  await call(object, "initializeRoom", { clientIP: "b", joinedAt: "two" });
  const third = await call(object, "initializeRoom", { clientIP: "c", joinedAt: "three" });
  const loaded = await call(object, "getRoom");

  assert.equal(third.body.roomFull, true);
  assert.equal(loaded.body.room.peers.length, 2);
});

test("room state keeps two client IDs that share one public IP", async () => {
  const { object } = createRoomState();

  await call(object, "initializeRoom", {
    clientId: "client-a",
    clientIP: "203.0.113.1",
    joinedAt: "one",
  });
  await call(object, "initializeRoom", {
    clientId: "client-b",
    clientIP: "203.0.113.1",
    joinedAt: "two",
  });
  await call(object, "registerPeer", {
    clientId: "client-a",
    peerId: "peer-a",
    isInitiator: true,
    clientIP: "203.0.113.1",
    joinedAt: "three",
  });
  await call(object, "registerPeer", {
    clientId: "client-b",
    peerId: "peer-b",
    isInitiator: false,
    clientIP: "203.0.113.1",
    joinedAt: "four",
  });
  const loaded = await call(object, "getRoom");

  assert.deepEqual(loaded.body.room.peers.map((peer) => peer.id), [
    "peer-a",
    "peer-b",
  ]);
});

test("peer registration is stored through the same room object", async () => {
  const { object } = createRoomState();

  await call(object, "initializeRoom", { clientIP: "a", joinedAt: "one" });
  const registered = await call(object, "registerPeer", {
    peerId: "peer-a",
    isInitiator: true,
    clientIP: "a",
    joinedAt: "two",
  });
  const loaded = await call(object, "getRoom");

  assert.equal(registered.body.alreadyRegistered, false);
  assert.equal(loaded.body.room.peers[0].id, "peer-a");
});

test("signals are returned once and expired entries are filtered", async () => {
  let now = 10 * SIGNAL_TTL_MS;
  const storage = new MemoryStorage();
  const object = new RoomState({ storage }, {}, () => now);

  now -= SIGNAL_TTL_MS;
  await call(object, "storeSignal", { peerId: "peer-a", signal: { type: "old" } });
  now += SIGNAL_TTL_MS;
  await call(object, "storeSignal", { peerId: "peer-a", signal: { type: "offer" } });

  const first = await call(object, "getAndClearSignals", { peerId: "peer-a" });
  const second = await call(object, "getAndClearSignals", { peerId: "peer-a" });

  assert.deepEqual(first.body.signals, [{ type: "offer" }]);
  assert.deepEqual(second.body.signals, []);
});

test("IP metadata is available until its expiry", async () => {
  let now = 1_000;
  const storage = new MemoryStorage();
  const object = new RoomState({ storage }, {}, () => now);

  await call(object, "storeIPInfo", {
    peerId: "peer-a",
    ipInfo: { ip: "203.0.113.1" },
  });
  const live = await call(object, "getIPInfo", { peerId: "peer-a" });
  now = storage.alarm;
  const expired = await call(object, "getIPInfo", { peerId: "peer-a" });

  assert.deepEqual(live.body.ipInfo, { ip: "203.0.113.1" });
  assert.equal(expired.body.ipInfo, null);
});

test("unsupported operations return a structured 400 response", async () => {
  const { object } = createRoomState();
  const result = await call(object, "unknownOperation");

  assert.equal(result.response.status, 400);
  assert.equal(result.body.error, "Unsupported room state operation");
});

test("alarm removes all room state", async () => {
  const { object, storage } = createRoomState();
  await call(object, "setRoom", { room: { peers: [] } });

  await object.alarm();

  assert.equal(storage.values.size, 0);
});
