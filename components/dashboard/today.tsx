import Link from "next/link";
import { ArrowRight, CircleCheck, Users, Wallet, Wallet2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/format";

type Props = {
  owing: { tenants: number; amount: number };
  unmatched: { count: number; amount: number };
  collected: number; expected: number;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The first thing on the home screen: three plain-language answers to "what do I need to do today?". */
export function Today({ owing, unmatched, collected, expected }: Props) {
  const allPaid = owing.tenants === 0;
  const nothingToMatch = unmatched.count === 0;
  const pct = expected > 0 ? Math.round((collected / expected) * 100) : null;

  const cards = [
    allPaid
      ? { key: "owing", tone: "ok", icon: CircleCheck, big: "All paid up", text: "Every tenant has paid for this month.", button: "View tenants", href: "/tenants" }
      : { key: "owing", tone: "warn", icon: Users, big: String(owing.tenants), text: `${plural(owing.tenants, "tenant hasn’t", "tenants haven’t")} paid yet`, sub: `${money(owing.amount)} still to collect`, button: "See who owes", href: "/tenants?filter=owing" },
    nothingToMatch
      ? { key: "match", tone: "ok", icon: CircleCheck, big: "Nothing to match", text: "Every payment is linked to a tenant.", button: "View payments", href: "/payments" }
      : { key: "match", tone: "warn", icon: Wallet2, big: String(unmatched.count), text: `${plural(unmatched.count, "payment needs", "payments need")} a tenant`, sub: `${money(unmatched.amount)} received but not linked to anyone yet`, button: "Match payments", href: "/payments#needs-matching" },
    { key: "received", tone: "info", icon: Wallet, big: money(collected), text: "received this month", sub: pct === null ? "No rent expected yet" : `${pct}% of the ${money(expected)} expected`, button: "See payments", href: "/payments" },
  ] as const;

  return (
    <section aria-labelledby="today-heading">
      <h2 id="today-heading" className="font-display text-[22px] font-medium tracking-tight">Today</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.key} className={`panel-card today-card today-${c.tone}`}>
            <div className="flex items-start gap-3 p-5">
              <span className="today-icon"><c.icon className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[30px] font-medium leading-tight tracking-tight">{c.big}</div>
                <div className="mt-1 text-[15px] font-medium">{c.text}</div>
                {"sub" in c && <div className="mt-1 text-[13px] text-muted-foreground">{c.sub}</div>}
              </div>
            </div>
            <div className="px-5 pb-5">
              <Link href={c.href} className="today-button">{c.button}<ArrowRight className="size-5" /></Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
