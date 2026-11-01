import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  decodePhoto, duplicateKey, isPlausibleDob, paymentSchema, registrationNumber, rollNumber, scholarshipRequestSchema,
} from "../../lib/scholarship/schema.js";

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString("base64");
const valid = {
  idempotencyKey: randomUUID(),
  studentName: "Aarav Sharma",
  studentClass: "10",
  dob: "2011-08-05",
  school: "St. Xavier's School, Jaipur",
  city: "Jaipur",
  pincode: "302001",
  parentName: "Neha Sharma",
  phone: "98765 43210",
  photo: jpeg,
  consent: true,
  noticeVersion: "2026-10-31",
  startedAt: 1,
};

test("a complete registration passes and the phone becomes +91", () => {
  const parsed = scholarshipRequestSchema.parse(valid);
  assert.equal(parsed.phone, "+919876543210");
  assert.equal(parsed.website, "");
});

test("only Class 9 and 10, real dates of birth, and no extra fields", () => {
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, studentClass: "8" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, dob: "2011-02-30" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, admin: true }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, phone: "12345" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, photo: "not base64!" }).success, false);
});

test("names and city are letters only; PIN code is exactly six digits", () => {
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, studentName: "Aarav 2" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, parentName: "N3ha" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, city: "Sector 45" }).success, false);
  assert.equal(scholarshipRequestSchema.safeParse({ ...valid, studentName: "Anaïs D'Souza-Rao" }).success, true);
  for (const pincode of ["30200", "3020011", "002001", "30a001", ""])
    assert.equal(scholarshipRequestSchema.safeParse({ ...valid, pincode }).success, false, pincode);
  const { pincode: _omit, ...noPin } = valid;
  assert.equal(scholarshipRequestSchema.safeParse(noPin).success, false);
});

test("payment: a registration number, a 64-hex token and a UPI reference", () => {
  const ok = { regNo: "SS26-10-00001", token: "a".repeat(64), utr: " 412345678901 " };
  assert.equal(paymentSchema.parse(ok).utr, "412345678901");
  assert.equal(paymentSchema.parse({ ...ok, utr: "abc123xyz" }).utr, "ABC123XYZ");
  assert.equal(paymentSchema.safeParse({ ...ok, utr: "12-34" }).success, false);
  assert.equal(paymentSchema.safeParse({ ...ok, regNo: "SS26-10-1" }).success, false);
  assert.equal(paymentSchema.safeParse({ ...ok, token: "x" }).success, false);
});

test("date of birth fits a Class 9-10 child", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  assert.equal(isPlausibleDob("2011-08-05", now), true);
  assert.equal(isPlausibleDob("2020-01-01", now), false);
  assert.equal(isPlausibleDob("1990-01-01", now), false);
  assert.equal(isPlausibleDob("05-08-2011", now), false);
});

test("only JPEG photos under the size limit are kept", () => {
  assert.ok(decodePhoto(jpeg));
  assert.equal(decodePhoto(Buffer.from("\x89PNG\r\n\x1a\nxxxx").toString("base64")), null);
  const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200 * 1024)]).toString("base64");
  assert.equal(decodePhoto(huge), null);
});

test("registration numbers and duplicate keys", () => {
  assert.equal(registrationNumber("9", 42), "SS26-09-00042");
  assert.equal(registrationNumber("10", 1), "SS26-10-00001");
  assert.equal(rollNumber("9", 42), "260900042");
  assert.equal(rollNumber("10", 1), "261000001");
  // One mobile number, one student: the key is the number alone.
  assert.equal(duplicateKey("+919876543210"), "scholarship-phone:+919876543210");
});
