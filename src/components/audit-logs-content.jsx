'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AdminDataTable } from '@/components/admin-data-table';
import useAdminContent from '@/hooks/use-admin-content';
import { formatDate } from '@/lib/format-date';

const actionStyles = {
  create: 'bg-success/15 text-success border-success/30',
  update: 'bg-primary/15 text-primary border-primary/30',
  delete: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function AuditLogsContent() {
  const { items: logs } = useAdminContent('audit-logs', []);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return logs.filter((log) =>
      [log.adminName, log.action, log.resource, log.resourceId, log.summary]
        .some((value) => (value || '').toLowerCase().includes(needle))
    );
  }, [logs, search]);

  const columns = [
    {
      key: 'createdAt',
      header: 'Time',
      accessor: (log) => formatDate(log.createdAt, 'MMM dd, yyyy h:mm a'),
    },
    { key: 'adminName', header: 'Admin', accessor: 'adminName', cellClassName: 'font-medium' },
    {
      key: 'action',
      header: 'Action',
      accessor: 'action',
      cell: (log) => (
        <Badge variant="outline" className={`capitalize ${actionStyles[log.action] || ''}`}>
          {log.action}
        </Badge>
      ),
    },
    { key: 'resource', header: 'Resource', accessor: 'resource' },
    { key: 'resourceId', header: 'Resource ID', accessor: 'resourceId' },
    { key: 'summary', header: 'Summary', accessor: 'summary' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Review admin create, update, and delete activity.</p>
      </div>

      <AdminDataTable
        columns={columns}
        rows={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search audit logs..."
        exportFileName="audit-logs.csv"
        emptyText="No audit logs found."
      />
    </div>
  );
}
