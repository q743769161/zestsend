export const SIGNAL_TTL_MS = 60 * 60 * 1_000;
export const ROOM_TTL_MS = 3 * 60 * 60 * 1_000;
export const IP_INFO_TTL_MS = ROOM_TTL_MS;

export function initializeRoom(room, clientIP, joinedAt) {
  if (!room) {
    return {
      room: {
        createdAt: joinedAt,
        peers: [{ ip: clientIP, joinedAt }],
      },
      isInitiator: true,
      roomFull: false,
    };
  }

  const peers = room.peers ?? [];
  if (peers.some((peer) => peer.ip === clientIP)) {
    return { room, isInitiator: false, roomFull: false };
  }

  if (peers.length >= 2) {
    return { room, isInitiator: false, roomFull: true };
  }

  return {
    room: {
      ...room,
      peers: [...peers, { ip: clientIP, joinedAt }],
    },
    isInitiator: false,
    roomFull: false,
  };
}

export function registerPeerInRoom(room, {
  peerId,
  isInitiator,
  clientIP,
  joinedAt,
}) {
  if (!room) {
    return {
      room: null,
      notFound: true,
      alreadyRegistered: false,
      roomFull: false,
    };
  }

  const peers = room.peers ?? [];
  if (peers.some((peer) => peer.id === peerId)) {
    return {
      room,
      notFound: false,
      alreadyRegistered: true,
      roomFull: false,
    };
  }

  const existingPeerIndex = peers.findIndex((peer) => peer.ip === clientIP);
  if (existingPeerIndex < 0 && peers.length >= 2) {
    return {
      room,
      notFound: false,
      alreadyRegistered: false,
      roomFull: true,
    };
  }

  const peerInfo = {
    id: peerId,
    type: isInitiator ? "initiator" : "receiver",
    ip: clientIP,
    joinedAt,
  };
  const nextPeers = [...peers];

  if (existingPeerIndex >= 0) {
    nextPeers[existingPeerIndex] = peerInfo;
  } else {
    nextPeers.push(peerInfo);
  }

  return {
    room: { ...room, peers: nextPeers },
    notFound: false,
    alreadyRegistered: false,
    roomFull: false,
  };
}

export function createExpiringValue(value, storedAt, ttlMs) {
  return { value, expiresAt: storedAt + ttlMs };
}

export function readExpiringValue(record, now) {
  if (!record || record.expiresAt <= now) {
    return null;
  }

  return record.value;
}

export function appendSignal(signals, signal, storedAt) {
  return [
    ...(signals ?? []),
    createExpiringValue(signal, storedAt, SIGNAL_TTL_MS),
  ];
}

export function takeLiveSignals(signals, now) {
  return (signals ?? [])
    .map((record) => readExpiringValue(record, now))
    .filter((signal) => signal !== null);
}
