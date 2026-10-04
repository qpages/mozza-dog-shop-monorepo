import assert from "node:assert/strict";
import test from "node:test";
import {
  VISITOR_COOKIE,
  parseVisitorId,
  resolveVisitorId,
} from "../src/shooting/visitor.js";

test("a missing or non-uuid cookie mints a new visitor", () => {
  assert.equal(VISITOR_COOKIE, "visitor");
  assert.equal(parseVisitorId(undefined), null);
  assert.equal(parseVisitorId("not-a-uuid"), null);
  assert.equal(parseVisitorId("token"), null);

  const minted = resolveVisitorId(undefined);
  assert.equal(minted.fresh, true);
  assert.equal(parseVisitorId(minted.id), minted.id);
});

test("an existing visitor cookie is kept", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(resolveVisitorId(id.toUpperCase()), {
    id,
    fresh: false,
  });
});
