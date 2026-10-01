import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicOwnerEvent } from "../src/shooting/owner-events.js";

const shootingId = "11111111-1111-4111-8111-111111111111";

test("a gallery open keeps the shooting; a claim or Instagram message does not", () => {
  assert.deepEqual(
    parsePublicOwnerEvent({
      email: "marie@example.com",
      type: "shooting_opened",
      shootingId,
    }),
    {
      ok: true,
      event: {
        email: "marie@example.com",
        type: "shooting_opened",
        shootingId,
        photoId: null,
      },
    },
  );

  for (const type of ["participation_claimed", "instagram_message"] as const) {
    assert.deepEqual(
      parsePublicOwnerEvent({
        email: "marie@example.com",
        type,
        shootingId,
      }),
      {
        ok: true,
        event: {
          email: "marie@example.com",
          type,
          shootingId: null,
          photoId: null,
        },
      },
    );
  }
});

test("downloads and an open without a shooting are not public events", () => {
  assert.deepEqual(
    parsePublicOwnerEvent({
      email: "marie@example.com",
      type: "zip_downloaded",
      shootingId,
    }),
    { ok: false, error: "invalid-type" },
  );
  assert.deepEqual(
    parsePublicOwnerEvent({
      email: "marie@example.com",
      type: "photo_downloaded",
      shootingId,
    }),
    { ok: false, error: "invalid-type" },
  );
  assert.deepEqual(
    parsePublicOwnerEvent({
      email: "marie@example.com",
      type: "shooting_opened",
    }),
    { ok: false, error: "shooting-required" },
  );
});
