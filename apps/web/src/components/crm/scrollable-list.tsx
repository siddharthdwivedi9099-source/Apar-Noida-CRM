import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const pageSizeChoices = [10, 25, 50, 0] as const; // 0 = All

interface ScrollableListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  /** Plural noun for the footer, e.g. "tickets". */
  label?: string;
  /** Rows shown before scrolling; the container itself scrolls beyond ~5 rows. */
  initialPageSize?: 10 | 25 | 50 | 0;
  /** Tailwind max-height class for the scroll container. */
  maxHeightClassName?: string;
  className?: string;
  contentClassName?: string;
}

/**
 * Client-side list viewport: every long list becomes a scrollable container
 * with a "Show N" selector (10/25/50/All), so screens stay compact and the
 * user chooses how many records to display. Purely presentational — the
 * caller keeps ownership of data and item rendering.
 */
export function ScrollableList<T>({
  items,
  renderItem,
  label = "records",
  initialPageSize = 10,
  maxHeightClassName = "max-h-[36rem]",
  className,
  contentClassName
}: ScrollableListProps<T>) {
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const visible = useMemo(() => (pageSize === 0 ? items : items.slice(0, pageSize)), [items, pageSize]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{visible.length}</span> of{" "}
          <span className="font-semibold text-foreground">{items.length}</span> {label}
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Show
          <select
            className="h-8 cursor-pointer rounded-lg border border-input bg-background px-2 text-xs shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {pageSizeChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 0 ? "All" : choice}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={cn("overflow-y-auto overscroll-contain pr-1", maxHeightClassName)}>
        <div className={cn("space-y-3", contentClassName)}>{visible.map((item, index) => renderItem(item, index))}</div>
      </div>
    </div>
  );
}
