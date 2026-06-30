"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  /** Giá trị dùng để sắp xếp/tìm kiếm (mặc định dùng cell text). */
  accessor?: (row: T) => string | number | null | undefined;
  /** Nội dung hiển thị của ô. */
  cell?: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  /** Hàm trả về chuỗi để tìm kiếm trên mỗi dòng. */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  /** Khu vực bên phải ô tìm kiếm (vd nút "Thêm"). */
  toolbar?: React.ReactNode;
  /** Cột "Hành động" cuối mỗi dòng. */
  actions?: (row: T) => React.ReactNode;
  emptyText?: string;
  pageSize?: number;
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  searchAccessor,
  searchPlaceholder = "Tìm kiếm…",
  toolbar,
  actions,
  emptyText = "Chưa có dữ liệu.",
  pageSize = 10,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Lọc theo từ khóa tìm kiếm.
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim() || !searchAccessor) return data;
    const q = debouncedQuery.trim().toLowerCase();
    return data.filter((row) => searchAccessor(row).toLowerCase().includes(q));
  }, [data, debouncedQuery, searchAccessor]);

  // Sắp xếp theo cột đang chọn.
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.accessor) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor!(a);
      const bv = col.accessor!(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv), "vi") * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Quay về trang 1 khi đổi bộ lọc/sắp xếp.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  const colCount = columns.length + (actions ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {searchAccessor ? (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
        ) : (
          <div />
        )}
        {toolbar}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable && col.accessor ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">Hành động</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.className)}>
                      {col.cell ? col.cell(row) : String(col.accessor?.(row) ?? "")}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right">{actions(row)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0
            ? "0 bản ghi"
            : `Hiển thị ${start + 1}–${Math.min(start + pageSize, total)} / ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Trang {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
