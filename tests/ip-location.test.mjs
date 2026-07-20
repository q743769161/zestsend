import assert from "node:assert/strict";
import test from "node:test";

let locationModule = {};

try {
  locationModule = await import("../lib/ip-location.mjs");
} catch {
  // The first TDD run intentionally reaches this branch before implementation.
}

test("Cloudflare request metadata produces coordinates for the same client IP", () => {
  assert.equal(typeof locationModule.createCloudflareIpInfo, "function");

  const result = locationModule.createCloudflareIpInfo("203.0.113.10", {
    city: "Hong Kong",
    region: "Hong Kong",
    country: "HK",
    latitude: "22.31930",
    longitude: "114.16940",
    timezone: "Asia/Hong_Kong",
    asOrganization: "Example ISP",
  });

  assert.deepEqual(result, {
    ip: "203.0.113.10",
    city: "Hong Kong",
    region: "Hong Kong",
    country_name: "HK",
    country_code: "HK",
    latitude: 22.3193,
    longitude: 114.1694,
    timezone: "Asia/Hong_Kong",
    org: "Example ISP",
    location_source: "cloudflare",
    location_accuracy: "approximate",
  });
});

test("missing geolocation never fabricates Beijing coordinates", () => {
  assert.equal(typeof locationModule.createUnavailableIpInfo, "function");

  const result = locationModule.createUnavailableIpInfo("203.0.113.10", {
    country: "HK",
    asOrganization: "Example ISP",
  });

  assert.equal(result.latitude, null);
  assert.equal(result.longitude, null);
  assert.equal(result.city, "Unknown");
  assert.equal(result.country_code, "HK");
  assert.equal(result._fallback, true);
});

test("invalid or out-of-range coordinates are rejected", () => {
  assert.equal(typeof locationModule.createCloudflareIpInfo, "function");

  assert.equal(locationModule.createCloudflareIpInfo("203.0.113.10", {
    latitude: "91",
    longitude: "114.16940",
  }), null);
  assert.equal(locationModule.createCloudflareIpInfo("203.0.113.10", {
    latitude: "not-a-number",
    longitude: "114.16940",
  }), null);
});

test("ipinfo fallback keeps the requested client IP and normalizes loc", () => {
  assert.equal(typeof locationModule.createIpInfoFromProvider, "function");

  const result = locationModule.createIpInfoFromProvider("203.0.113.10", {
    ip: "198.51.100.99",
    city: "Tokyo",
    region: "Tokyo",
    country: "JP",
    loc: "35.67620,139.65030",
    timezone: "Asia/Tokyo",
    org: "Example ISP",
  });

  assert.equal(result.ip, "203.0.113.10");
  assert.equal(result.latitude, 35.6762);
  assert.equal(result.longitude, 139.6503);
  assert.equal(result.location_source, "ipinfo");
});

test("coordinate availability accepts valid zero values and rejects missing values", () => {
  assert.equal(typeof locationModule.hasUsableCoordinates, "function");

  assert.equal(locationModule.hasUsableCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(locationModule.hasUsableCoordinates({ latitude: null, longitude: 114 }), false);
  assert.equal(locationModule.hasUsableCoordinates({ latitude: 22, longitude: 181 }), false);
});

test("a remote peer remains displayable when both peers share one public IP", () => {
  assert.equal(typeof locationModule.shouldDisplayPeerLocation, "function");

  const local = {
    ip: "203.0.113.10",
    latitude: 22.3193,
    longitude: 114.1694,
  };
  const peer = {
    ip: "203.0.113.10",
    latitude: 22.3193,
    longitude: 114.1694,
  };

  assert.equal(locationModule.shouldDisplayPeerLocation(local, peer), true);
});
