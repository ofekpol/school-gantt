import "server-only";
import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const CHARSET = UPPER + LOWER + DIGITS;

/**
 * Random per-user temporary password for admin-created staff accounts.
 * Excludes 0/O/1/l/I so an admin can read and relay it without ambiguity.
 * Never reused across users — see docs/superpowers/specs/2026-08-17-direct-staff-creation-design.md.
 */
export function generateTempPassword(length = 10): string {
  const required = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ];
  const rest = Array.from({ length: length - required.length }, () => CHARSET[randomInt(CHARSET.length)]);
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
