'use client';

import { useMemo, useState } from 'react';
import { FileClock, Layers, Search, ShieldCheck, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const [actionFilter, setActionFilter] = useState('all');

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return logs.filter((log) =>
      [log.adminName, log.action, log.resource, log.resourceId, log.summary]
        .some((value) => (value || '').toLowerCase().includes(needle)) &&
      (actionFilter === 'all' || log.action === actionFilter)
    );
  }, [logs, actionFilter, search]);

  const stats = useMemo(() => ({
    total: logs.length,
    admins: new Set(logs.map((log) => log.adminName).filter(Boolean)).size,
    resources: new Set(logs.map((log) => log.resource).filter(Boolean)).size,
    deletes: logs.filter((log) => log.action === 'delete').length,
  }), [logs]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Review admin create, update, and delete activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Logs', value: stats.total, icon: FileClock },
          { label: 'Admins', value: stats.admins, icon: UserCog },
          { label: 'Resources', value: stats.resources, icon: Layers },
          { label: 'Deletes', value: stats.deletes, icon: ShieldCheck },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search audit logs..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="hidden md:table-cell">Summary</TableHead>
                  <TableHead className="hidden lg:table-cell">Resource ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No audit logs found.</TableCell>
                  </TableRow>
                ) : filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{formatDate(log.createdAt, 'MMM dd, yyyy h:mm a')}</TableCell>
                    <TableCell className="font-medium">{log.adminName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${actionStyles[log.action] || ''}`}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.resource}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{log.summary || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{log.resourceId || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
