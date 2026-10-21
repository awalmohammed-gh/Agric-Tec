'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';

// No manual useMemo/useCallback: the React Compiler memoizes this hook.

export type SortDir = 'asc' | 'desc';

export interface TableSort {
  key: string;
  dir: SortDir;
}

type Sortable = string | number | boolean | null | undefined;

export interface AdminTableOptions<T> {
  /** A stable ID per row, for selection. */
  getRowId: (row: T) => string;
  /** Fields (or accessors for nested values) the search box matches, case-insensitively. */
  searchKeys: (keyof T | ((row: T) => Sortable))[];
  /**
   * Named filters. A row passes when every filter with a value in the URL returns true.
   * Names become URL params, so they must not be 'q', 'sort', 'dir' or 'page'.
   */
  filters?: Record<string, (row: T, value: string) => boolean>;
  /** Values to sort by, per sort key. Without one, the key is read from the row itself. */
  sortAccessors?: Record<string, (row: T) => Sortable>;
  initialSort?: TableSort;
  pageSize?: number;
}

const RESERVED = new Set(['q', 'sort', 'dir', 'page']);

function compare(a: Sortable, b: Sortable): number {
  // Empty values always sort last.
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) return Number(emptyA) - Number(emptyB);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Search, filters, sorting, pagination and selection for an admin table.
 * State lives in the URL (?q=&status=&sort=&dir=&page=) so a filtered view can be shared.
 * Uses useSearchParams: wrap the component that calls it in a <Suspense> boundary.
 */
export function useAdminTable<T>(rows: T[], options: AdminTableOptions<T>) {
  const {
    getRowId,
    searchKeys,
    filters = {},
    sortAccessors = {},
    initialSort,
    pageSize = 25,
  } = options;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function updateParams(changes: Record<string, string | null>, resetPage = true): void {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Search: the input updates at once; the URL and the results follow 250ms after typing stops.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 250);
  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    if (debouncedQuery === urlQuery) return;
    const next = new URLSearchParams(params.toString());
    if (debouncedQuery) next.set('q', debouncedQuery);
    else next.delete('q');
    next.delete('page');
    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [debouncedQuery, urlQuery, params, pathname, router]);

  const filterValues: Record<string, string> = Object.fromEntries(
    Object.keys(filters)
      .filter((name) => !RESERVED.has(name))
      .map((name) => [name, params.get(name) ?? '']),
  );
  const setFilter = (name: string, value: string | null) => updateParams({ [name]: value });

  const sortKey = params.get('sort');
  const sort: TableSort | null = sortKey
    ? { key: sortKey, dir: params.get('dir') === 'desc' ? 'desc' : 'asc' }
    : (initialSort ?? null);
  /** Sets a sort; without `dir`, choosing the same column again flips the direction. */
  const setSort = (key: string, dir?: SortDir) => {
    const nextDir = dir ?? (sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc');
    updateParams({ sort: key, dir: nextDir }, false);
  };

  const needle = debouncedQuery.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (needle) {
      const hit = searchKeys.some((key) => {
        const value = typeof key === 'function' ? key(row) : row[key];
        return (
          value !== null && value !== undefined && String(value).toLowerCase().includes(needle)
        );
      });
      if (!hit) return false;
    }
    return Object.entries(filterValues).every(
      ([name, value]) => !value || filters[name](row, value),
    );
  });
  if (sort) {
    const accessor =
      sortAccessors[sort.key] ?? ((row: T) => (row as Record<string, Sortable>)[sort.key]);
    const direction = sort.dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => compare(accessor(a), accessor(b)) * direction);
  }

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), pageCount);
  const setPage = (next: number) => updateParams({ page: next > 1 ? String(next) : null }, false);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Selection survives paging and filtering, but forgets rows that no longer exist.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const existingIds = new Set(rows.map(getRowId));
  const selected: ReadonlySet<string> = new Set(
    [...selectedIds].filter((id) => existingIds.has(id)),
  );
  const selectedRows = rows.filter((row) => selected.has(getRowId(row)));

  const toggle = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pageIds = pageRows.map(getRowId);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  /** Selects every row on this page, or clears them if they are all selected already. */
  const toggleAllOnPage = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (allOnPageSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  return {
    query,
    setQuery,
    filters: filterValues,
    setFilter,
    sort,
    setSort,
    page,
    setPage,
    pageCount,
    pageRows,
    total,
    selected,
    selectedRows,
    allOnPageSelected,
    toggle,
    toggleAllOnPage,
    clearSelection,
  };
}
