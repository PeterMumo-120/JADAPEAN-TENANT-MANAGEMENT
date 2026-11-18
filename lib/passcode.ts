/**
 * Passcode hashing with WebCrypto PBKDF2-SHA256.
 * Works on Cloudflare Workers, Bun and Node 20+. No native packages.
 *
 * Used by BOTH the login action and scripts/seed-admin.ts, so they can never disagree.
 * If you change ITERATIONS, existing admins can no longer sign in until their passcode is reset.
 */
const ITERATIONS = 100_000; // Cloudflare Workers rejects PBKDF2 above 100,000 iterations
const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

const fromHex = (hex: string) =>
  new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

async function derive(passcode: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPasscode(passcode: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: toHex(await derive(passcode, salt)), salt: toHex(salt) };
}

export async function verifyPasscode(passcode: string, hashHex: string, saltHex: string): Promise<boolean> {
  const actual = await derive(passcode, fromHex(saltHex));
  const expected = fromHex(hashHex);
  if (actual.length !== expected.length) return false;
  let diff = 0; // constant-time comparison
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
