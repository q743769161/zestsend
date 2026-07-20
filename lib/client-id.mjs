export const CLIENT_ID_STORAGE_KEY = "zestsend-client-id";

export function getOrCreateClientId(storage, createId) {
  let existing = null;
  try {
    existing = storage.getItem(CLIENT_ID_STORAGE_KEY);
  } catch {
    return createId();
  }

  if (existing) {
    return existing;
  }

  const clientId = createId();
  try {
    storage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  } catch {
    // A temporary in-memory identity still lets the current page join a room.
  }
  return clientId;
}
