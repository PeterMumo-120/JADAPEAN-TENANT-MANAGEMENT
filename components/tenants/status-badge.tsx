import { Badge } from "@/components/ui/badge";
import type { RentStatus } from "@/lib/tenants/status";

export function StatusBadge({ status }: { status: RentStatus | "Moved out" }) {
  const tone = status === "Moved out" ? "status-pending" : `status-${status.toLowerCase()}`;
  return (
    <Badge variant="outline" className={`status-badge ${tone}`}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />{status}
    </Badge>
  );
}
