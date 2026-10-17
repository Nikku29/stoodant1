import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidFields, leadRequestSchema, normaliseIndianMobile } from "../../lib/lead/schema.js";
import { isAllowedOrigin } from "../../lib/lib/origin.js";

const valid = {
  idempotencyKey: "0b8f6c1e-5d2a-4c7e-9f3b-1a2b3c4d5e6f",
  parentName: "Anita Sharma",
  studentClass: "7",
  board: "CBSE",
  phone: "98765 43210",
  consent: true,
  noticeVersion: "2026-10-17",
  startedAt: 1_792_000_000_000,
};

test("normalises Indian mobile numbers to E.164", () => {
  for (const input of ["9876543210", "+91 98765 43210", "919876543210", "09876543210", "98765-43210"]) {
    assert.equal(normaliseIndianMobile(input), "+919876543210", input);
  }
  for (const input of ["5876543210", "987654321", "+1 9876543210", "98765432101", "abcdefghij"]) {
    assert.equal(normaliseIndianMobile(input), null, input);
  }
});

test("accepts a valid request and normalises the phone", () => {
  const parsed = leadRequestSchema.parse(valid);
  assert.equal(parsed.phone, "+919876543210");
  assert.equal(parsed.website, "");
  assert.deepEqual(parsed.source, { path: "/" });
});

test("rejects bad fields and reports names only", () => {
  const result = leadRequestSchema.safeParse({ ...valid, phone: "12345", studentClass: "11", consent: false });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(invalidFields(result.error).sort(), ["consent", "phone", "studentClass"]);
});

test("rejects unknown fields and names with digits or markup", () => {
  assert.equal(leadRequestSchema.safeParse({ ...valid, studentName: "Ravi" }).success, false);
  assert.equal(leadRequestSchema.safeParse({ ...valid, parentName: "<script>" }).success, false);
  assert.equal(leadRequestSchema.safeParse({ ...valid, parentName: "R2D2" }).success, false);
  assert.equal(leadRequestSchema.safeParse({ ...valid, parentName: "Śrī Devī" }).success, true);
});

test("origin allow-list supports preview-channel patterns", () => {
  const allowed = ["https://stoodant.com", "https://stoodant-staging--*.web.app"];
  assert.equal(isAllowedOrigin("https://stoodant.com", allowed), true);
  assert.equal(isAllowedOrigin("https://stoodant-staging--pr-12-ab3d.web.app", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.web.app", allowed), false);
  assert.equal(isAllowedOrigin("https://stoodant.com.evil.com", allowed), false);
  assert.equal(isAllowedOrigin(undefined, allowed), false);
});
