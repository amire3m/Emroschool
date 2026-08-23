import assert from "node:assert/strict";
import test from "node:test";

import { rateLimit } from "../lib/rate-limit";

test("allows requests within the limit", () => {
  const key = `test-allow-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    const result = rateLimit(key, 3, 60_000);
    assert.equal(result.allowed, true);
  }
});

test("blocks requests beyond the limit and reports retry delay", () => {
  const key = `test-block-${Math.random()}`;
  rateLimit(key, 2, 60_000);
  rateLimit(key, 2, 60_000);
  const result = rateLimit(key, 2, 60_000);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterSeconds > 0);
  assert.ok(result.retryAfterSeconds <= 60);
});

test("isolates keys independently", () => {
  const a = `test-iso-a-${Math.random()}`;
  const b = `test-iso-b-${Math.random()}`;
  rateLimit(a, 1, 60_000);
  const blocked = rateLimit(a, 1, 60_000);
  const allowed = rateLimit(b, 1, 60_000);
  assert.equal(blocked.allowed, false);
  assert.equal(allowed.allowed, true);
});

test("resets after the window expires", () => {
  const key = `test-reset-${Math.random()}`;
  rateLimit(key, 1, 1);
  rateLimit(key, 1, 1);
  const blocked = rateLimit(key, 1, 1);
  assert.equal(blocked.allowed, false);
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = rateLimit(key, 1, 1);
      assert.equal(result.allowed, true);
      resolve(undefined);
    }, 5);
  });
});
