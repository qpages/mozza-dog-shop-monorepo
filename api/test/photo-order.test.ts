import assert from "node:assert/strict";
import test from "node:test";
import { prependSortOrder, samePhotoSet } from "../src/shooting/photo-order.js";

test("prependSortOrder starts at 0 then goes before the current first photo", () => {
  assert.equal(prependSortOrder(null), 0);
  assert.equal(prependSortOrder(0), -1);
  assert.equal(prependSortOrder(-3), -4);
});

test("samePhotoSet requires the exact ids, once each", () => {
  const existing = ["a", "b", "c"];
  assert.equal(samePhotoSet(["c", "a", "b"], existing), true);
  assert.equal(samePhotoSet(["a", "b"], existing), false);
  assert.equal(samePhotoSet(["a", "b", "b"], existing), false);
  assert.equal(samePhotoSet(["a", "b", "d"], existing), false);
});
