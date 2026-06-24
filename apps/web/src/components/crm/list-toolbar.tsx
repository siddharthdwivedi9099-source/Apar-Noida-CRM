import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { selectClassName } from "@/lib/crm";

export interface ListFilterOption {
  value: string;
  label: string;
}

export interface ListFilter {
  /** Used as the "All <label>" placeholder and the select key. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ListFilterOption[];
}

export interface ListSortOption {
  value: string;
  label: string;
}

interface ListToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ListFilter[];
  sortBy: string;
  onSortBy: (value: string) => void;
  sortOptions: ListSortOption[];
  sortOrder: "asc" | "desc";
  onSortOrder: (value: "asc" | "desc") => void;
  resultCount: number;
  totalCount: number;
  noun?: string;
  onReset?: () => void;
}

/**
 * Consistent search + filter + sort toolbar for client-side list filtering.
 * Drop it above a record list and drive a useMemo from its state.
 */
export function ListToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search...",
  filters = [],
  sortBy,
  onSortBy,
  sortOptions,
  sortOrder,
  onSortOrder,
  resultCount,
  totalCount,
  noun = "results",
  onReset
}: ListToolbarProps) {
  return (
    <div className="space-y-2">
      <Input placeholder={searchPlaceholder} value={search} onChange={(event) => onSearch(event.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">
        {filters.map((filter) => (
          <select
            key={filter.label}
            aria-label={filter.label}
            className={selectClassName}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
          >
            <option value="">{`All ${filter.label.toLowerCase()}`}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <select aria-label="Sort by" className={selectClassName} value={sortBy} onChange={(event) => onSortBy(event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{`Sort: ${option.label}`}</option>
          ))}
        </select>
        <select
          aria-label="Sort order"
          className={selectClassName}
          value={sortOrder}
          onChange={(event) => onSortOrder(event.target.value as "asc" | "desc")}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {resultCount} of {totalCount} {noun}
        </p>
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}
