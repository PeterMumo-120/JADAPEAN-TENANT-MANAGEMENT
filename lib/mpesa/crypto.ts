// Encrypts Daraja consumer secrets before they are stored. AES-GCM via WebCrypto (works on Workers and Node).
// SHORTCODE_ENC_KEY is any long random string (32+ characters). Losing or changing it makes saved secrets unreadable,
// and the fix is simply to re-enter them on the shortcode's edit page.
const enc = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SHORTCODE_ENC_KEY ?? "";
  if (secret.length < 16) throw new Error("SHORTCODE_ENC_KEY is not set (or too short). Add a long random string to your environment first.");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, await getKey(), enc.encode(plain));
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptSecret(blob: string): Promise<string> {
  const [v, iv, ct] = blob.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Saved secret is in an unknown format. Re-enter it on the shortcode page.");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) as unknown as BufferSource }, await getKey(), fromB64(ct) as unknown as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Couldn’t decrypt the saved secret (SHORTCODE_ENC_KEY changed?). Re-enter it on the shortcode page.");
  }
}
