import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Node's built-in scrypt (memory-hard), so no native hashing dependency is needed.
// N=2^15 needs 32 MiB per hash, above Node's 32 MiB default maxmem, hence the explicit limit.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { ...options, maxmem: 128 * options.N! * options.r! * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * Hash a password into a self-describing string:
 * `scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>`. The parameters are stored
 * with the hash, so they can be raised later without breaking existing users.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time check of a password against a `hashPassword()` string. Malformed hashes never match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length === 0) return false;
  try {
    const key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, { N, r, p });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// A real hash of a random password, so sign-ins for unknown emails take as long
// as sign-ins for known ones (no user enumeration by timing).
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
