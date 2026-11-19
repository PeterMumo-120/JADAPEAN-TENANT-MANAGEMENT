/** One-off: registers the shortcode for the Pull Transactions API. Usage: bun run mpesa:register-pull */
import { callbackUrls } from "../lib/mpesa/config";
import { registerPull } from "../lib/mpesa/client";

try {
  console.log(JSON.stringify(await registerPull(callbackUrls().confirmation), null, 2));
  console.log("\nResponseStatus 1000 = registered, 1001 = already registered (both fine).");
} catch (e) {
  console.error("\n✖", e instanceof Error ? e.message : e);
  process.exit(1);
}
