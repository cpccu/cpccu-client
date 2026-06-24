'use client';

import { Download, FileSpreadsheet, Search } from 'lucide-react';
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
import * as XLSX from 'xlsx';

const STUDENT_ID_KEYS = ['recipientStudentId', 'recipientId', 'studentId', 'uniID', 'student_id'];

const getText = (row, accessor) => {
  if (typeof accessor === 'function') return accessor(row);
  return accessor.split('.').reduce((value, key) => value?.[key], row);
};

const isStudentIdColumn = (column) => {
  const key = (column.accessor || column.key || '').toString().toLowerCase();
  return STUDENT_ID_KEYS.some((idKey) => key.includes(idKey.toLowerCase()));
};

export function exportRowsToXlsx(rows, columns, fileName) {
  const exportableColumns = columns.filter((column) => column.export !== false);
  const headerRow = exportableColumns.map((column) => column.header);
  const dataRows = rows.map((row) =>
    exportableColumns.map((column) => {
      const raw = getText(row, column.accessor || column.key);
      if (isStudentIdColumn(column)) {
        return { t: 's', v: raw ?? '', w: String(raw ?? '') };
      }
      return raw ?? '';
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  exportableColumns.forEach((column, colIndex) => {
    if (isStudentIdColumn(column)) {
      const colLetter = XLSX.utils.encode_col(colIndex);
      if (!ws[`!ref`]) ws['!ref'] = `A1:${XLSX.utils.encode_col(exportableColumns.length - 1)}${dataRows.length + 1}`;
      if (!ws[`${colLetter}1`]) return;
      ws['!cols'] = ws['!cols'] || [];
      ws['!cols'][colIndex] = ws['!cols'][colIndex] || {};
      ws['!cols'][colIndex].t = 's';
      ws['!cols'][colIndex].z = '@';
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const xlsxFile = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([xlsxFile], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/\.csv$/i, '.xlsx');
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminDataTable({
  columns,
  emptyText = 'No records found.',
  exportFileName = 'admin-export.xlsx',
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
              onClick={() => exportRowsToXlsx(rows, columns, exportFileName)}
              disabled={!rows.length}
            >
              <FileSpreadsheet className="size-4" />
              Export XLSX
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
