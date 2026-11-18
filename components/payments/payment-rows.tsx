import { Check } from "lucide-react";
import { money } from "@/lib/format";
import type { payments } from "@/lib/mock-data";

type PaymentItem = (typeof payments)[number];

export function PaymentRows({ items }: { items: PaymentItem[] }) {
  return (
    <div className="flex flex-col">
      {items.map((payment) => (
        <div className="payment-row" key={payment.id}>
          <div className="payment-check"><Check className="size-3.5" /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{payment.name}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {payment.unit} · {payment.building} <span className="mx-1 text-border">·</span><span className="font-mono">{payment.receipt}</span>
            </div>
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
