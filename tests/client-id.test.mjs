import assert from "node:assert/strict";
import test from "node:test";

test("client ID is generated once and reused from browser storage", async () => {
  let clientIdModule = {};
  try {
    clientIdModule = await import("../lib/client-id.mjs");
  } catch {
    // The first TDD run intentionally reaches this branch before implementation.
  }

  assert.equal(typeof clientIdModule.getOrCreateClientId, "function");

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let generated = 0;
  const createId = () => `client-${++generated}`;

  const first = clientIdModule.getOrCreateClientId(storage, createId);
  const second = clientIdModule.getOrCreateClientId(storage, createId);

  assert.equal(first, "client-1");
  assert.equal(second, "client-1");
  assert.equal(generated, 1);
});

test("client ID still works when browser storage is unavailable", async () => {
  const { getOrCreateClientId } = await import("../lib/client-id.mjs");
  const blockedStorage = {
    getItem: () => {
      throw new Error("storage blocked");
    },
    setItem: () => {
      throw new Error("storage blocked");
    },
  };

  let clientId = null;
  try {
    clientId = getOrCreateClientId(blockedStorage, () => "temporary-client");
  } catch {
    // Convert the pre-fix storage exception into the intended behavior assertion.
  }

  assert.equal(clientId, "temporary-client");
});
