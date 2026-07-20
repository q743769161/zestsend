import assert from "node:assert/strict";
import test from "node:test";

import {
  IP_INFO_TTL_MS,
  SIGNAL_TTL_MS,
  appendSignal,
  createExpiringValue,
  initializeRoom,
  readExpiringValue,
  registerPeerInRoom,
  takeLiveSignals,
} from "../worker/room-state-core.mjs";

const FIRST_JOINED_AT = "2026-07-20T00:00:00.000Z";
const SECOND_JOINED_AT = "2026-07-20T00:01:00.000Z";

test("first client creates a room and becomes initiator", () => {
  const result = initializeRoom(null, "203.0.113.1", FIRST_JOINED_AT);

  assert.deepEqual(result, {
    room: {
      createdAt: FIRST_JOINED_AT,
      peers: [{ ip: "203.0.113.1", joinedAt: FIRST_JOINED_AT }],
    },
    isInitiator: true,
    roomFull: false,
  });
});

test("refreshing from the same IP does not add another peer", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [{ ip: "203.0.113.1", joinedAt: FIRST_JOINED_AT }],
  };

  const result = initializeRoom(existingRoom, "203.0.113.1", SECOND_JOINED_AT);

  assert.equal(result.isInitiator, false);
  assert.equal(result.roomFull, false);
  assert.deepEqual(result.room, existingRoom);
});

test("second unique client joins an existing room", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [{ ip: "203.0.113.1", joinedAt: FIRST_JOINED_AT }],
  };

  const result = initializeRoom(existingRoom, "203.0.113.2", SECOND_JOINED_AT);

  assert.equal(result.isInitiator, false);
  assert.equal(result.roomFull, false);
  assert.deepEqual(result.room.peers[1], {
    ip: "203.0.113.2",
    joinedAt: SECOND_JOINED_AT,
  });
});

test("third unique client cannot join a two-person room", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [{ ip: "203.0.113.1" }, { ip: "203.0.113.2" }],
  };

  const result = initializeRoom(existingRoom, "203.0.113.3", SECOND_JOINED_AT);

  assert.equal(result.isInitiator, false);
  assert.equal(result.roomFull, true);
  assert.equal(result.room, existingRoom);
});

test("peer registration reports a missing room", () => {
  const result = registerPeerInRoom(null, {
    peerId: "peer-a",
    isInitiator: true,
    clientIP: "203.0.113.1",
    joinedAt: FIRST_JOINED_AT,
  });

  assert.deepEqual(result, {
    room: null,
    notFound: true,
    alreadyRegistered: false,
    roomFull: false,
  });
});

test("peer registration replaces the placeholder for the same IP", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [{ ip: "203.0.113.1", joinedAt: FIRST_JOINED_AT }],
  };

  const result = registerPeerInRoom(existingRoom, {
    peerId: "peer-a",
    isInitiator: true,
    clientIP: "203.0.113.1",
    joinedAt: SECOND_JOINED_AT,
  });

  assert.equal(result.notFound, false);
  assert.equal(result.alreadyRegistered, false);
  assert.deepEqual(result.room.peers, [{
    id: "peer-a",
    type: "initiator",
    ip: "203.0.113.1",
    joinedAt: SECOND_JOINED_AT,
  }]);
});

test("duplicate peer registration is idempotent", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [{
      id: "peer-a",
      type: "initiator",
      ip: "203.0.113.1",
      joinedAt: FIRST_JOINED_AT,
    }],
  };

  const result = registerPeerInRoom(existingRoom, {
    peerId: "peer-a",
    isInitiator: true,
    clientIP: "203.0.113.1",
    joinedAt: SECOND_JOINED_AT,
  });

  assert.equal(result.alreadyRegistered, true);
  assert.equal(result.room, existingRoom);
});

test("direct registration cannot overfill a room", () => {
  const existingRoom = {
    createdAt: FIRST_JOINED_AT,
    peers: [
      { id: "peer-a", ip: "203.0.113.1" },
      { id: "peer-b", ip: "203.0.113.2" },
    ],
  };

  const result = registerPeerInRoom(existingRoom, {
    peerId: "peer-c",
    isInitiator: false,
    clientIP: "203.0.113.3",
    joinedAt: SECOND_JOINED_AT,
  });

  assert.equal(result.roomFull, true);
  assert.equal(result.room, existingRoom);
});

test("signal dequeue returns only live signals in insertion order", () => {
  const now = 10 * SIGNAL_TTL_MS;
  let signals = appendSignal([], { type: "old" }, now - SIGNAL_TTL_MS);
  signals = appendSignal(signals, { type: "offer" }, now - 1);
  signals = appendSignal(signals, { type: "answer" }, now);

  assert.deepEqual(takeLiveSignals(signals, now), [
    { type: "offer" },
    { type: "answer" },
  ]);
});

test("expiring values remain live until their exact expiry boundary", () => {
  const storedAt = 1_000;
  const record = createExpiringValue({ ip: "203.0.113.1" }, storedAt, IP_INFO_TTL_MS);

  assert.deepEqual(readExpiringValue(record, storedAt + IP_INFO_TTL_MS - 1), {
    ip: "203.0.113.1",
  });
  assert.equal(readExpiringValue(record, storedAt + IP_INFO_TTL_MS), null);
});
