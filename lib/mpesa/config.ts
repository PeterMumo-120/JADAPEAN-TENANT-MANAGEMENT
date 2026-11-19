/** Safaricom's callback IPs. Only enforced when MPESA_ENV=production (sandbox/Postman calls come from elsewhere). */
export const SAFARICOM_IPS = [
  "196.201.214.200", "196.201.214.206", "196.201.213.114", "196.201.214.207",
  "196.201.214.208", "196.201.213.44", "196.201.212.127", "196.201.212.138",
  "196.201.212.129", "196.201.212.136", "196.201.212.74", "196.201.212.69",
];

export function mpesaConfig() {
  const env = process.env.MPESA_ENV === "production" ? "production" : "sandbox";
  return {
    env,
    baseUrl: env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    shortcode: process.env.MPESA_SHORTCODE ?? "",
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "",
    nominatedNumber: process.env.MPESA_NOMINATED_NUMBER ?? "",
    appUrl: (process.env.APP_URL ?? "").replace(/\/$/, ""),
    callbackSecret: process.env.MPESA_CALLBACK_SECRET ?? "",
  };
}

export function isConfigured() {
  const c = mpesaConfig();
  return !!(c.shortcode && c.consumerKey && c.consumerSecret);
}

/** Webhook URLs to register with Safaricom. The secret is part of the path and must not contain words like "mpesa" or "query". */
export function callbackUrls() {
  const c = mpesaConfig();
  if (!c.appUrl || !c.callbackSecret) throw new Error("Set APP_URL and MPESA_CALLBACK_SECRET first.");
  const base = `${c.appUrl}/api/c2b/${c.callbackSecret}`;
  return { confirmation: `${base}/confirmation`, validation: `${base}/validation` };
}

export function callerIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

/** The secret in the URL must match; in production the caller must also be a Safaricom IP. */
export function webhookAllowed(req: Request, secret: string): { ok: boolean; reason?: string } {
  const c = mpesaConfig();
  if (!c.callbackSecret || secret !== c.callbackSecret) return { ok: false, reason: "bad secret" };
  if (c.env === "production" && !SAFARICOM_IPS.includes(callerIp(req))) return { ok: false, reason: `ip ${callerIp(req)} not allowed` };
  return { ok: true };
}
