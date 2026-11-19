// Talks to Daraja. No database imports here, so the register scripts can use it too.
import { mpesaConfig } from "./config";

type Token = { value: string; expiresAt: number };
const store = globalThis as unknown as { __mpesaToken?: Token };

async function fetchToken(): Promise<string> {
  const c = mpesaConfig();
  if (!c.consumerKey || !c.consumerSecret) throw new Error("MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are not set.");
  const res = await fetch(`${c.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${c.consumerKey}:${c.consumerSecret}`)}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status}). Check the consumer key and secret.`);
  const j = (await res.json()) as { access_token: string; expires_in?: string };
  store.__mpesaToken = { value: j.access_token, expiresAt: Date.now() + (Number(j.expires_in ?? 3599) - 60) * 1000 };
  return j.access_token;
}

async function token(force = false) {
  const t = store.__mpesaToken;
  return !force && t && t.expiresAt > Date.now() ? t.value : fetchToken();
}

class DarajaError extends Error {
  constructor(message: string, readonly status: number, readonly body: string) { super(message); }
}

const TOKEN_ERROR = /404\.001\.03|401\.001|400\.003\.01|Invalid Access Token/i;

/** POST to Daraja. If the token was rejected (expired, or invalidated by another request) retry once with a fresh one. */
async function post<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${mpesaConfig().baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token(attempt > 0)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (attempt === 0 && (res.status === 401 || TOKEN_ERROR.test(text))) continue;
    if (!res.ok) throw new DarajaError(`Daraja ${path} failed (${res.status}): ${text.slice(0, 300)}`, res.status, text);
    try { return JSON.parse(text) as T; } catch { return { raw: text } as T; }
  }
  throw new Error("Daraja rejected the access token twice.");
}

export const registerC2B = (urls: { confirmation: string; validation: string }) =>
  post<Record<string, unknown>>("/mpesa/c2b/v2/registerurl", {
    ShortCode: mpesaConfig().shortcode, ResponseType: "Completed", ConfirmationURL: urls.confirmation, ValidationURL: urls.validation,
  });

export const registerPull = (callbackUrl: string) => {
  const c = mpesaConfig();
  if (!callbackUrl.startsWith("https://")) throw new Error("Pull registration needs a secure (https) callback URL. Set APP_URL to your public https address, not localhost.");
  if (!c.nominatedNumber) throw new Error("MPESA_NOMINATED_NUMBER is not set.");
  return post<Record<string, unknown>>("/pulltransactions/v1/register", {
    ShortCode: c.shortcode, RequestType: "Pull", NominatedNumber: c.nominatedNumber, CallBackURL: callbackUrl,
  });
};

export type PullTransaction = {
  transactionId: string; trxDate: string; msisdn?: string; sender?: string; transactiontype?: string;
  billreference?: string; amount: string | number; organizationname?: string;
};

/** Daraja reads Pull dates as Nairobi time ("YYYY-MM-DD HH:mm:ss"). A Worker runs in UTC, so format explicitly. */
export function eatStamp(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

const NO_TRANSACTIONS = /retrieve transactions|no (available )?transactions|does not have any available/i;

/** Everything paid in the last 47 hours (Pull only goes back 48), following OffSetValue until a page comes back empty. */
export async function pullTransactions(hours = 47): Promise<PullTransaction[]> {
  const shortcode = mpesaConfig().shortcode;
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600e3);
  const found = new Map<string, PullTransaction>();
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    let r: { ResponseCode?: string; Response?: unknown };
    try {
      r = await post<{ ResponseCode?: string; Response?: unknown }>("/pulltransactions/v1/query", {
        ShortCode: shortcode, StartDate: eatStamp(start), EndDate: eatStamp(end), OffSetValue: String(offset),
      });
    } catch (e) {
      // Safaricom answers a quiet period with HTTP 500 "no transactions available". That is an empty result, not a failure.
      if (e instanceof DarajaError && e.status === 500 && NO_TRANSACTIONS.test(e.body)) break;
      throw e;
    }
    const batch = (Array.isArray(r.Response) ? (r.Response as unknown[][]).flat() : []) as PullTransaction[];
    const fresh = batch.filter((t) => t?.transactionId && !found.has(t.transactionId));
    if (r.ResponseCode === "1001" || fresh.length === 0) break;
    fresh.forEach((t) => found.set(t.transactionId, t));
    offset += batch.length;
  }
  return [...found.values()];
}
