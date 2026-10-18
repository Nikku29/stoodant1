import { createHmac } from "node:crypto";

/** HMAC-SHA256 with a secret pepper, so stored hashes of phone numbers or IPs can't be reversed by brute force. */
export function keyedHash(pepper: string, value: string): string {
  return createHmac("sha256", pepper).update(value).digest("hex");
}
