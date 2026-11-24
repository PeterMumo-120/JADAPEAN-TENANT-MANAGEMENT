import { Check, Clock3 } from "lucide-react";
import { money } from "@/lib/format";
import { MatchBadge } from "@/components/payments/match-badge";
import type { PaymentItem } from "@/lib/payments/queries";

export function PaymentRows({ items }: { items: PaymentItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((payment) => (
        <div className="payment-row" key={payment.id}>
          <div className="payment-check" style={payment.matched ? undefined : { background: "color-mix(in srgb, var(--destructive) 10%, white)", color: "var(--destructive)" }}>
            {payment.matched ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{payment.name}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {payment.unit} · {payment.building}{payment.via ? ` · ${payment.via}` : ""} <span className="mx-1 text-border">·</span><span className="font-mono">{payment.receipt}</span>
            </div>
            {payment.autoMethod && <MatchBadge paymentId={payment.id} reason={payment.autoReason} />}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold">{money(payment.amount)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{payment.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
