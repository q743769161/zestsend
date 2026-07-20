function parseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") return null;

  const coordinate = Number.parseFloat(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    return null;
  }

  return coordinate;
}

export function hasUsableCoordinates(info) {
  return Boolean(
    info &&
    parseCoordinate(info.latitude, -90, 90) !== null &&
    parseCoordinate(info.longitude, -180, 180) !== null
  );
}

export function shouldDisplayPeerLocation(_localInfo, peerInfo) {
  return hasUsableCoordinates(peerInfo);
}

export function createCloudflareIpInfo(ip, cf = {}) {
  const latitude = parseCoordinate(cf.latitude, -90, 90);
  const longitude = parseCoordinate(cf.longitude, -180, 180);

  if (latitude === null || longitude === null) return null;

  return {
    ip,
    city: cf.city || "Unknown",
    region: cf.region || "Unknown",
    country_name: cf.country || "Unknown",
    country_code: cf.country || "Unknown",
    latitude,
    longitude,
    timezone: cf.timezone || "Unknown",
    org: cf.asOrganization || "Unknown",
    location_source: "cloudflare",
    location_accuracy: "approximate",
  };
}

export function createIpInfoFromProvider(ip, data = {}) {
  const [rawLatitude, rawLongitude] = String(data.loc || "").split(",");
  const latitude = parseCoordinate(rawLatitude, -90, 90);
  const longitude = parseCoordinate(rawLongitude, -180, 180);

  if (latitude === null || longitude === null) return null;

  return {
    ip,
    city: data.city || "Unknown",
    region: data.region || "Unknown",
    country_name: data.country || "Unknown",
    country_code: data.country || "Unknown",
    latitude,
    longitude,
    timezone: data.timezone || "Unknown",
    org: data.org || "Unknown",
    location_source: "ipinfo",
    location_accuracy: "approximate",
  };
}

export function createUnavailableIpInfo(ip, cf = {}) {
  return {
    ip,
    city: "Unknown",
    region: cf.region || "Unknown",
    country_name: cf.country || "Unknown",
    country_code: cf.country || "Unknown",
    latitude: null,
    longitude: null,
    timezone: cf.timezone || "Unknown",
    org: cf.asOrganization || "Unknown",
    location_source: "unavailable",
    location_accuracy: "unknown",
    _fallback: true,
  };
}
