import {
  IP_INFO_TTL_MS,
  ROOM_TTL_MS,
  appendSignal,
  createExpiringValue,
  initializeRoom,
  readExpiringValue,
  registerPeerInRoom,
  takeLiveSignals,
} from "./room-state-core.mjs";

function json(body, status = 200) {
  return Response.json(body, { status });
}

export class RoomState {
  constructor(state, env, now = Date.now) {
    this.state = state;
    this.env = env;
    this.now = now;
  }

  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "Invalid JSON request" }, 400);
    }

    const { operation, payload = {} } = input ?? {};

    try {
      switch (operation) {
        case "setRoom":
          await this.writeExpiring("room", payload.room, ROOM_TTL_MS);
          return json({ success: true });

        case "getRoom":
          return json({ room: await this.readExpiring("room") });

        case "roomExists":
          return json({ exists: (await this.readExpiring("room")) !== null });

        case "initializeRoom":
          return json(await this.initialize(payload));

        case "registerPeer":
          return json(await this.registerPeer(payload));

        case "storeSignal":
          await this.storeSignal(payload.peerId, payload.signal);
          return json({ success: true });

        case "getAndClearSignals":
          return json({ signals: await this.getAndClearSignals(payload.peerId) });

        case "storeIPInfo":
          await this.writeExpiring(
            `ip:${payload.peerId}`,
            payload.ipInfo,
            IP_INFO_TTL_MS,
          );
          return json({ success: true });

        case "getIPInfo":
          return json({ ipInfo: await this.readExpiring(`ip:${payload.peerId}`) });

        case "cleanupRoom":
          await this.state.storage.deleteAll();
          return json({ success: true });

        default:
          return json({ error: "Unsupported room state operation" }, 400);
      }
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "room_state_operation_failed",
        operation,
        message: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: "Room state operation failed" }, 500);
    }
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }

  async initialize({ clientId, clientIP, joinedAt }) {
    const room = await this.readExpiring("room");
    const result = initializeRoom(room, clientIP, joinedAt, clientId ?? clientIP);

    if (!result.roomFull) {
      await this.writeExpiring("room", result.room, ROOM_TTL_MS);
    }

    return result;
  }

  async registerPeer(payload) {
    const room = await this.readExpiring("room");
    const result = registerPeerInRoom(room, payload);

    if (!result.notFound && !result.alreadyRegistered && !result.roomFull) {
      await this.writeExpiring("room", result.room, ROOM_TTL_MS);
    }

    return result;
  }

  async storeSignal(peerId, signal) {
    const key = `signals:${peerId}`;
    const signals = await this.state.storage.get(key);
    await this.state.storage.put(key, appendSignal(signals, signal, this.now()));
  }

  async getAndClearSignals(peerId) {
    const key = `signals:${peerId}`;
    const signals = await this.state.storage.get(key);
    await this.state.storage.delete(key);
    return takeLiveSignals(signals, this.now());
  }

  async readExpiring(key) {
    const record = await this.state.storage.get(key);
    const value = readExpiringValue(record, this.now());

    if (record && value === null) {
      await this.state.storage.delete(key);
    }

    return value;
  }

  async writeExpiring(key, value, ttlMs) {
    const record = createExpiringValue(value, this.now(), ttlMs);
    await this.state.storage.put(key, record);
    await this.state.storage.setAlarm(record.expiresAt);
  }
}
