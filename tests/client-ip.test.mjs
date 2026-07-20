import assert from "node:assert/strict";
import test from "node:test";

import { getClientIP } from "../lib/client-ip.mjs";

test("Cloudflare connecting IP takes precedence", () => {
  assert.equal(getClientIP({
    headers: {
      "cf-connecting-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    },
  }), "203.0.113.1");
});

test("first forwarded IP is used outside Cloudflare", () => {
  assert.equal(getClientIP({
    headers: { "x-forwarded-for": "198.51.100.1, 198.51.100.2" },
  }), "198.51.100.1");
});

test("missing Node socket is safe in the Workers runtime", () => {
  assert.equal(getClientIP({ headers: {} }), "127.0.0.1");
});

test("Node remote address remains available for local development", () => {
  assert.equal(getClientIP({
    headers: {},
    socket: { remoteAddress: "::1" },
  }), "::1");
});
