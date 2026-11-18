import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <div className="metric-grid">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
