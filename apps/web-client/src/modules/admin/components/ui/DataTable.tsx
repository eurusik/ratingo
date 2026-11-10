'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type Header,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';

import { cn, createPlaceholderKeys } from '@/shared/utils';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Skeleton } from '@/shared/ui/skeleton';
import { useTranslation } from '@/shared/i18n';

import { DataTableProps } from '../../types';

const SKELETON_ROW_KEYS = createPlaceholderKeys('skeleton-row', 5);

function toAriaSort<T>(header: Header<T, unknown>): React.AriaAttributes['aria-sort'] {
  if (!header.column.getCanSort()) return undefined;
  const sortDirection = header.column.getIsSorted();
  if (sortDirection === 'asc') return 'ascending';
  if (sortDirection === 'desc') return 'descending';
  return 'none';
}

function sortIconClassName(isActive: boolean, positionClassName?: string) {
  return cn('h-3 w-3', positionClassName, isActive ? 'text-foreground' : 'text-muted-foreground');
}

function HeaderContent<T>({ header }: { header: Header<T, unknown> }) {
  const label = flexRender(header.column.columnDef.header, header.getContext());

  if (!header.column.getCanSort()) {
    return <div className="flex items-center space-x-2">{label}</div>;
  }

  const sortDirection = header.column.getIsSorted();
  return (
    <button
      type="button"
      className="flex items-center space-x-2 cursor-pointer select-none"
      onClick={header.column.getToggleSortingHandler()}
    >
      {label}
      <span className="flex flex-col">
        <ChevronUp className={sortIconClassName(sortDirection === 'asc')} />
        <ChevronDown className={sortIconClassName(sortDirection === 'desc', '-mt-1')} />
      </span>
    </button>
  );
}

function DataTable<T>({
  data,
  columns,
  loading = false,
  error,
  pagination,
  sorting,
  onSortingChange,
  onPaginationChange,
  rowActions,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    sorting ? [{ id: sorting.column, desc: sorting.direction === 'desc' }] : [],
  );

  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: pagination?.page ? pagination.page - 1 : 0,
    pageSize: pagination?.limit ?? 10,
  });

  const { dict } = useTranslation();

  // Convert custom column definitions to TanStack Table format
  const tanstackColumns = React.useMemo(() => {
    const cols: ColumnDef<T>[] = columns.map((col) => ({
      id: col.id,
      header: col.header, // Use string directly
      accessorKey: col.accessorKey as string,
      cell: col.cell,
      enableSorting: col.sortable !== false,
      meta: {
        width: col.width,
        sortable: col.sortable,
      },
    }));

    if (rowActions) {
      cols.push({
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const actions = rowActions(row.original);
          if (!actions.length) return null;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      action.variant === 'destructive' && 'text-destructive focus:text-destructive',
                    )}
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        meta: {
          width: '50px',
        },
      });
    }

    return cols;
  }, [columns, rowActions]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(internalSorting) : updater;
      setInternalSorting(newSorting);

      if (onSortingChange && newSorting.length > 0) {
        onSortingChange({
          column: newSorting[0].id,
          direction: newSorting[0].desc ? 'desc' : 'asc',
        });
      }
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' ? updater(internalPagination) : updater;
      setInternalPagination(newPagination);

      if (onPaginationChange) {
        onPaginationChange({
          page: newPagination.pageIndex + 1,
          limit: newPagination.pageSize,
        });
      }
    },
    state: {
      sorting: internalSorting,
      pagination: internalPagination,
    },
    manualSorting: !!onSortingChange,
    manualPagination: !!pagination,
    pageCount: pagination ? Math.ceil(pagination.total / pagination.limit) : undefined,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div className="text-destructive">
          <p className="font-medium">{dict.admin.common.error}</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {tanstackColumns.map((column) => (
                  <TableHead key={column.id}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SKELETON_ROW_KEYS.map((rowKey) => (
                <TableRow key={rowKey}>
                  {tanstackColumns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tanstackColumns.map((column) => (
                <TableHead key={column.id}>{column.header as React.ReactNode}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <div className="p-8 text-center">
          {emptyState || (
            <div className="text-muted-foreground">
              <p>{dict.admin.common.noData}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnMeta = header.column.columnDef.meta as {
                    width?: string;
                    sortable?: boolean;
                  };
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: columnMeta?.width }}
                      aria-sort={toAriaSort(header)}
                    >
                      {header.isPlaceholder ? null : <HeaderContent header={header} />}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {dict.admin.common.pagination.showing}{' '}
            {internalPagination.pageIndex * internalPagination.pageSize + 1}{' '}
            {dict.admin.common.pagination.to}{' '}
            {Math.min(
              (internalPagination.pageIndex + 1) * internalPagination.pageSize,
              pagination.total,
            )}{' '}
            {dict.admin.common.pagination.of} {pagination.total}{' '}
            {dict.admin.common.pagination.entries}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {dict.admin.common.pagination.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {dict.admin.common.pagination.next}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
