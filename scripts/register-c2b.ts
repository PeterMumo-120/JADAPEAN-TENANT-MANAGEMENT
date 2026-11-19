/** One-off: registers the C2B Confirmation/Validation URLs. Usage: bun run mpesa:register-c2b */
import { callbackUrls } from "../lib/mpesa/config";
import { registerC2B } from "../lib/mpesa/client";

try {
  const urls = callbackUrls();
  console.log("Registering:\n ", urls.confirmation, "\n ", urls.validation);
  console.log(JSON.stringify(await registerC2B(urls), null, 2));
} catch (e) {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
}
