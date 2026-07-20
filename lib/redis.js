import { getCloudflareContext } from "@opennextjs/cloudflare";

async function callRoomState(roomId, operation, payload = {}) {
  const { env } = getCloudflareContext();

  if (!env.ROOM_STATE) {
    throw new Error("Missing Cloudflare Durable Object binding: ROOM_STATE");
  }

  const objectId = env.ROOM_STATE.idFromName(String(roomId));
  const stub = env.ROOM_STATE.get(objectId);
  const response = await stub.fetch(
    `https://room-state.internal/${encodeURIComponent(String(roomId))}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation, payload }),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Room state operation failed: ${response.status}`);
  }

  return result;
}

export async function setRoom(roomId, room) {
  await callRoomState(roomId, "setRoom", { room });
}

export async function getRoom(roomId) {
  const result = await callRoomState(roomId, "getRoom");
  return result.room;
}

export async function roomExists(roomId) {
  const result = await callRoomState(roomId, "roomExists");
  return result.exists;
}

export async function initializeRoom(roomId, clientIP, clientId = clientIP) {
  return callRoomState(roomId, "initializeRoom", {
    clientId,
    clientIP,
    joinedAt: new Date().toISOString(),
  });
}

export async function registerPeer(
  roomId,
  peerId,
  isInitiator,
  clientIP,
  clientId = clientIP,
) {
  return callRoomState(roomId, "registerPeer", {
    peerId,
    clientId,
    isInitiator,
    clientIP,
    joinedAt: new Date().toISOString(),
  });
}

export async function storeSignal(roomId, peerId, signal) {
  await callRoomState(roomId, "storeSignal", { peerId, signal });
}

export async function getAndClearSignals(roomId, peerId) {
  const result = await callRoomState(roomId, "getAndClearSignals", { peerId });
  return result.signals;
}

export async function storeIPInfo(roomId, peerId, ipInfo) {
  await callRoomState(roomId, "storeIPInfo", { peerId, ipInfo });
}

export async function getIPInfo(roomId, peerId) {
  const result = await callRoomState(roomId, "getIPInfo", { peerId });
  return result.ipInfo;
}

export async function cleanupRoom(roomId) {
  await callRoomState(roomId, "cleanupRoom");
}
