import assert from "node:assert/strict";
import test from "node:test";
import {
  changeOwnerEmail,
  parseOwnerEmail,
  type EmailAssignment,
  type OwnerEmailPort,
  type OwnerParticipation,
} from "../src/shooting/owner-email.js";

const shootingId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

test("parseOwnerEmail trims, lowercases, and rejects a non-address", () => {
  assert.equal(parseOwnerEmail("  Ada@Example.com "), "ada@example.com");
  assert.equal(parseOwnerEmail("pas-un-email"), null);
  assert.equal(parseOwnerEmail(`a@${"b".repeat(320)}.co`), null);
});

test("changeOwnerEmail keeps the same address without writing", async () => {
  const port = memory({ status: "active", email: "ada@example.com" });
  const result = await changeOwnerEmail(port, {
    shootingId,
    ownerId,
    email: "  ADA@Example.com ",
  });

  assert.deepEqual(result, { ok: true, email: "ada@example.com" });
  assert.deepEqual(port.assigned, []);
});

test("changeOwnerEmail writes a new address", async () => {
  const port = memory({ status: "active", email: "ada@example.com" });
  const result = await changeOwnerEmail(port, {
    shootingId,
    ownerId,
    email: "new@example.com",
  });

  assert.deepEqual(result, { ok: true, email: "new@example.com" });
  assert.deepEqual(port.assigned, ["new@example.com"]);
});

test("changeOwnerEmail refuses an address held by someone else", async () => {
  const port = memory({ status: "active", email: "ada@example.com" }, "taken");
  const result = await changeOwnerEmail(port, {
    shootingId,
    ownerId,
    email: "taken@example.com",
  });

  assert.deepEqual(result, { ok: false, error: "taken" });
});

test("changeOwnerEmail leaves an archived shooting untouched", async () => {
  const port = memory({ status: "archived" });
  const result = await changeOwnerEmail(port, {
    shootingId,
    ownerId,
    email: "new@example.com",
  });

  assert.deepEqual(result, { ok: false, error: "archived" });
  assert.deepEqual(port.assigned, []);
});

test("changeOwnerEmail does not load a shooting for an invalid address", async () => {
  let loaded = false;
  const port: OwnerEmailPort = {
    async load() {
      loaded = true;
      return { status: "active", email: "ada@example.com" };
    },
    async assign() {
      return "saved";
    },
  };

  const result = await changeOwnerEmail(port, {
    shootingId,
    ownerId,
    email: "nope",
  });

  assert.deepEqual(result, { ok: false, error: "invalid-email" });
  assert.equal(loaded, false);
});

test("changeOwnerEmail reports a missing owner and a missing shooting", async () => {
  const missingOwner = await changeOwnerEmail(
    memory({ status: "owner-missing" }),
    { shootingId, ownerId, email: "ada@example.com" },
  );
  const missingShooting = await changeOwnerEmail(
    memory({ status: "shooting-missing" }),
    { shootingId, ownerId, email: "ada@example.com" },
  );
  const deletedDuringSave = await changeOwnerEmail(
    memory({ status: "active", email: "old@example.com" }, "missing"),
    { shootingId, ownerId, email: "new@example.com" },
  );

  assert.deepEqual(missingOwner, { ok: false, error: "owner-missing" });
  assert.deepEqual(missingShooting, { ok: false, error: "shooting-missing" });
  assert.deepEqual(deletedDuringSave, { ok: false, error: "owner-missing" });
});

function memory(
  participation: OwnerParticipation,
  assignment: EmailAssignment = "saved",
): OwnerEmailPort & { assigned: string[] } {
  const assigned: string[] = [];
  return {
    assigned,
    async load() {
      return participation;
    },
    async assign(_ownerId, email) {
      assigned.push(email);
      return assignment;
    },
  };
}
