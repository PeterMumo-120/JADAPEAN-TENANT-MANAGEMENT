import type { ShortcodeRow } from "@/db/schema";

/** Safaricom's callback IPs. Enforced for production shortcodes (sandbox/Postman calls come from elsewhere). */
export const SAFARICOM_IPS = [
  "196.201.214.200", "196.201.214.206", "196.201.213.114", "196.201.214.207",
  "196.201.214.208", "196.201.213.44", "196.201.212.127", "196.201.212.138",
  "196.201.212.129", "196.201.212.136", "196.201.212.74", "196.201.212.69",
];

/** App-wide settings only. Everything per paybill/till (number, env, Daraja keys) lives in the `shortcodes` table. */
export function mpesaConfig() {
  return {
    appUrl: (process.env.APP_URL ?? "").replace(/\/$/, ""),
    callbackSecret: process.env.MPESA_CALLBACK_SECRET ?? "",
  };
}

/** One URL pair serves every shortcode: each payload says which shortcode it belongs to. */
export function callbackUrls() {
  const c = mpesaConfig();
  if (!c.appUrl || !c.callbackSecret) throw new Error("Set APP_URL and MPESA_CALLBACK_SECRET first.");
  const base = `${c.appUrl}/api/c2b/${c.callbackSecret}`;
  return { confirmation: `${base}/confirmation`, validation: `${base}/validation` };
}

const BLOCKED_WORDS = /mpesa|m-pesa|safaricom|exec|cmd|sql|query/i;

/** Safaricom rejects production URLs that are not https or that contain certain words. Returns an error message or null. */
export function urlProblem(url: string, env: ShortcodeRow["env"]): string | null {
  if (env === "production" && !url.startsWith("https://")) return "Production callback URLs must be https. Set APP_URL to your public https address.";
  if (env === "production" && BLOCKED_WORDS.test(url)) return "Safaricom blocks URLs containing words like mpesa, safaricom, exec, cmd, sql or query. Change APP_URL or MPESA_CALLBACK_SECRET.";
  return null;
}

export function callerIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export const isSafaricomIp = (req: Request) => SAFARICOM_IPS.includes(callerIp(req));

/** Step 1 of the webhook gate: the secret in the URL path must match. The IP check happens once the shortcode is known. */
export function secretOk(secret: string): boolean {
  const c = mpesaConfig();
  return !!c.callbackSecret && secret === c.callbackSecret;
}

/**
 * Step 2: production (and unknown) shortcodes must come from a Safaricom IP. Sandbox shortcodes skip the IP check
 * so you can test with curl or Postman.
 */
export function ipAllowed(req: Request, shortcode: ShortcodeRow | null): boolean {
  if (shortcode?.env === "sandbox") return true;
  return isSafaricomIp(req);
}
