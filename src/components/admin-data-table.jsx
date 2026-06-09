'use client';

import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const getText = (row, accessor) => {
  if (typeof accessor === 'function') return accessor(row);
  return accessor.split('.').reduce((value, key) => value?.[key], row);
};

const toCsvCell = (value) => {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

export function exportRowsToCsv(rows, columns, fileName) {
  const exportableColumns = columns.filter((column) => column.export !== false);
  const csv = [
    exportableColumns.map((column) => toCsvCell(column.header)).join(','),
    ...rows.map((row) =>
      exportableColumns
        .map((column) => toCsvCell(getText(row, column.accessor || column.key)))
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminDataTable({
  columns,
  emptyText = 'No records found.',
  exportFileName = 'admin-export.csv',
  onSearchChange,
  rows,
  searchPlaceholder = 'Search...',
  searchValue,
  toolbar,
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {toolbar}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => exportRowsToCsv(rows, columns, exportFileName)}
              disabled={!rows.length}
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.cellClassName}>
                        {column.cell
                          ? column.cell(row)
                          : getText(row, column.accessor || column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
