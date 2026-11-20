import { Badge } from "@/components/ui/badge";

/** "Paybill 400200" / "Till 5123456" as a small pill. */
export function ShortcodeBadge({ type, number, label }: { type: "paybill" | "till"; number: string; label?: string }) {
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <span className="font-medium">{type === "till" ? "Till" : "Paybill"}</span>
      <span className="font-mono">{number}</span>
      {label ? <span className="hidden text-muted-foreground sm:inline">· {label}</span> : null}
    </Badge>
  );
}
