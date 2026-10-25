import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStarts, meetingLink, overlaps, when } from "../../lib/classes/rules.js";

test("only Zoom and Google Meet links are accepted", () => {
  assert.equal(meetingLink("https://us06web.zoom.us/j/81234567890?pwd=abc"), "https://us06web.zoom.us/j/81234567890?pwd=abc");
  assert.equal(meetingLink(" https://zoom.us/my/akash "), "https://zoom.us/my/akash");
  assert.equal(meetingLink("https://meet.google.com/abc-defg-hij"), "https://meet.google.com/abc-defg-hij");
  for (const bad of [
    "http://zoom.us/j/123", // not https
    "https://zoom.us.evil.com/j/123", // look-alike host
    "https://evilzoom.us/j/123",
    "https://user:pw@zoom.us/j/123",
    "https://meet.google.com/not-a-code",
    "https://zoom.us/",
    "javascript:alert(1)",
    "zoom.us/j/123",
    42,
    "",
  ])
    assert.equal(meetingLink(bad), null, String(bad));
});

test("start times: future, within 120 days, at most 26, sorted and unique", () => {
  const now = Date.parse("2026-10-25T10:00:00Z");
  assert.deepEqual(checkStarts(["2026-10-28T11:30:00Z", "2026-10-27T11:30:00Z", "2026-10-27T11:30:00Z"], now), [
    Date.parse("2026-10-27T11:30:00Z"),
    Date.parse("2026-10-28T11:30:00Z"),
  ]);
  assert.equal(typeof checkStarts([], now), "string");
  assert.equal(typeof checkStarts(["2026-10-25T09:00:00Z"], now), "string");
  assert.equal(typeof checkStarts(["2027-06-01T09:00:00Z"], now), "string");
  assert.equal(typeof checkStarts(["not a date"], now), "string");
  assert.equal(typeof checkStarts(Array.from({ length: 27 }, (_, i) => new Date(now + (i + 1) * 86_400_000).toISOString()), now), "string");
  // A class that started a minute ago (Start now on a slow phone) is still fine.
  assert.deepEqual(checkStarts(["2026-10-25T09:59:00Z"], now), [Date.parse("2026-10-25T09:59:00Z")]);
});

test("overlap and India-time wording", () => {
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 }), false);
  assert.equal(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 }), true);
  assert.equal(when(Date.parse("2026-10-28T11:30:00Z")), "Wed 28 Oct, 5:00 pm");
});
