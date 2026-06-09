'use client';
import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Award, Edit2, Trash2, Eye, Download, Copy, Check, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { demoCertificates } from '@/lib/demo-data';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import { useCreateAdminCertificateMutation, useDeleteAdminCertificateMutation, useGetAdminCertificatesQuery, useUpdateAdminCertificateMutation } from '@/features/admin/adminApi';
import { AdminDataTable } from '@/components/admin-data-table';
const placementConfig = {
    '1st': { label: '1st Place', variant: 'default' },
    '2nd': { label: '2nd Place', variant: 'secondary' },
    '3rd': { label: '3rd Place', variant: 'outline' },
    participant: { label: 'Participant', variant: 'outline' },
    completion: { label: 'Completion', variant: 'outline' },
};
export function CertificatesContent() {
    const [certificates, setCertificates] = useState(demoCertificates);
    const { data: certificatesResponse } = useGetAdminCertificatesQuery();
    const [createCertificate] = useCreateAdminCertificateMutation();
    const [updateCertificate] = useUpdateAdminCertificateMutation();
    const [deleteCertificate] = useDeleteAdminCertificateMutation();
    const [searchQuery, setSearchQuery] = useState('');
    const [placementFilter, setPlacementFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [editingCert, setEditingCert] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [bulkCsv, setBulkCsv] = useState('');
    const [formData, setFormData] = useState({
        recipientName: '',
        recipientStudentId: '',
        eventName: '',
        placement: '1st',
    });
    useEffect(() => {
        if (certificatesResponse?.data) {
            setCertificates(certificatesResponse.data.map((certificate) => ({
                id: certificate._id,
                certificateId: certificate.certificateId,
                recipientName: certificate.recipientName,
                recipientStudentId: certificate.recipientId,
                eventName: certificate.contestName,
                placement: certificate.certificateType === 'runner-up'
                    ? '2nd'
                    : certificate.certificateType === '2nd-runner-up'
                        ? '3rd'
                        : certificate.certificateType === 'participation'
                            ? 'participant'
                            : '1st',
                issuedAt: certificate.issueDate,
                verificationUrl: `/verify/${certificate.certificateId}`,
            })));
        }
    }, [certificatesResponse]);
    const filteredCerts = certificates.filter((cert) => {
        const matchesSearch = cert.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.certificateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.recipientStudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.eventName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlacement = placementFilter === 'all' || cert.placement === placementFilter;
        return matchesSearch && matchesPlacement;
    });
    const stats = {
        total: certificates.length,
        firstPlace: certificates.filter((c) => c.placement === '1st').length,
        secondPlace: certificates.filter((c) => c.placement === '2nd').length,
        thirdPlace: certificates.filter((c) => c.placement === '3rd').length,
    };
    const generateCertificateId = () => {
        const year = new Date().getFullYear();
        const num = String(certificates.length + 1).padStart(3, '0');
        return `CPCCU-${year}-${num}`;
    };
    const handleOpenDialog = (cert) => {
        if (cert) {
            setEditingCert(cert);
            setFormData({
                recipientName: cert.recipientName,
                recipientStudentId: cert.recipientStudentId,
                eventName: cert.eventName,
                placement: cert.placement,
            });
        }
        else {
            setEditingCert(null);
            setFormData({
                recipientName: '',
                recipientStudentId: '',
                eventName: '',
                placement: '1st',
            });
        }
        setDialogOpen(true);
    };
    const handleSave = async () => {
        const certificateType = formData.placement === '2nd'
            ? 'runner-up'
            : formData.placement === '3rd'
                ? '2nd-runner-up'
                : formData.placement === 'participant' || formData.placement === 'completion'
                    ? 'participation'
                    : 'winner';
        const payload = {
            recipientName: formData.recipientName,
            recipientId: formData.recipientStudentId,
            contestName: formData.eventName,
            contestType: 'programming-contest',
            certificateType,
            issueDate: new Date().toISOString(),
            description: `${formData.recipientName} received a CPCCU certificate for ${formData.eventName}.`,
        };
        if (editingCert) {
            await updateCertificate({ id: editingCert.id, body: payload });
            showSuccessAlert('Updated!', 'Certificate updated successfully');
        }
        else {
            const newCertId = generateCertificateId();
            await createCertificate({ ...payload, certificateId: newCertId });
            showSuccessAlert('Issued!', 'Certificate issued successfully');
        }
        setDialogOpen(false);
    };
    const handleDelete = async (id) => {
        const result = await showDeleteConfirm('Delete Certificate', 'This will permanently remove this certificate.');
        if (result.isConfirmed) {
            await deleteCertificate(id);
            showSuccessAlert('Deleted!', 'Certificate removed');
        }
    };
    const handleCopyId = (certId) => {
        navigator.clipboard.writeText(certId);
        setCopiedId(certId);
        setTimeout(() => setCopiedId(null), 2000);
    };
    const openCertificate = (certificateId, shouldPrint = false) => {
        const certificateWindow = window.open(`/verify/${certificateId}`, '_blank');
        if (shouldPrint && certificateWindow) {
            certificateWindow.addEventListener('load', () => certificateWindow.print());
        }
    };
    const handleBulkIssue = async () => {
        const rows = bulkCsv
            .split('\n')
            .map((row) => row.trim())
            .filter(Boolean)
            .map((row) => row.split(',').map((cell) => cell.trim()));
        const dataRows = rows[0]?.[0]?.toLowerCase().includes('name') ? rows.slice(1) : rows;
        await Promise.all(dataRows.map(([recipientName, recipientId, contestName, placement = 'participant'], index) => {
            const normalizedPlacement = placement.toLowerCase();
            const certificateType = normalizedPlacement.includes('2')
                ? 'runner-up'
                : normalizedPlacement.includes('3')
                    ? '2nd-runner-up'
                    : normalizedPlacement.includes('winner') || normalizedPlacement.includes('1')
                        ? 'winner'
                        : 'participation';
            return createCertificate({
                certificateId: `CPCCU-${new Date().getFullYear()}-${String(certificates.length + index + 1).padStart(3, '0')}`,
                recipientName,
                recipientId,
                contestName,
                contestType: 'programming-contest',
                certificateType,
                issueDate: new Date().toISOString(),
                description: `${recipientName} received a CPCCU certificate for ${contestName}.`,
            });
        }));
        setBulkDialogOpen(false);
        setBulkCsv('');
        showSuccessAlert('Bulk Issued', `${dataRows.length} certificates have been queued.`);
    };
    const columns = [
        {
            key: 'certificateId',
            header: 'Certificate ID',
            accessor: 'certificateId',
            cell: (cert) => (<div className="flex items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {cert.certificateId}
              </code>
              <Button variant="ghost" size="icon" className="size-6" onClick={() => handleCopyId(cert.certificateId)}>
                {copiedId === cert.certificateId ? (<Check className="size-3 text-green-500"/>) : (<Copy className="size-3"/>)}
              </Button>
            </div>),
        },
        { key: 'recipientName', header: 'Recipient', accessor: 'recipientName', cellClassName: 'font-medium' },
        { key: 'recipientStudentId', header: 'Student ID', accessor: 'recipientStudentId', cellClassName: 'text-muted-foreground' },
        { key: 'eventName', header: 'Event', accessor: 'eventName' },
        {
            key: 'placement',
            header: 'Placement',
            accessor: 'placement',
            cell: (cert) => <Badge variant={placementConfig[cert.placement]?.variant || 'outline'}>{placementConfig[cert.placement]?.label || cert.placement}</Badge>,
        },
        { key: 'issuedAt', header: 'Issued Date', accessor: (cert) => formatDate(cert.issuedAt), cellClassName: 'text-muted-foreground' },
        {
            key: 'actions',
            header: '',
            export: false,
            className: 'w-12',
            cell: (cert) => (<DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenDialog(cert)}>
                  <Edit2 className="mr-2 size-4"/>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCertificate(cert.certificateId)}>
                  <Eye className="mr-2 size-4"/>
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCertificate(cert.certificateId, true)}>
                  <Download className="mr-2 size-4"/>
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(cert.id)}>
                  <Trash2 className="mr-2 size-4"/>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>),
        },
    ];
    return (<div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certificate Management</h1>
        <p className="text-muted-foreground">Issue and manage certificates for contest winners and participants.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Award className="size-4"/>
                <span className="text-sm">Total</span>
              </div>
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Award className="size-4"/>
                <span className="text-sm">1st Place</span>
              </div>
              <span className="text-2xl font-bold">{stats.firstPlace}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Award className="size-4"/>
                <span className="text-sm">2nd Place</span>
              </div>
              <span className="text-2xl font-bold">{stats.secondPlace}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700">
                <Award className="size-4"/>
                <span className="text-sm">3rd Place</span>
              </div>
              <span className="text-2xl font-bold">{stats.thirdPlace}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Issued Certificates</h2>
            <p className="text-sm text-muted-foreground">Manage all certificates issued by CPCCU</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setBulkDialogOpen(true)} className="gap-2">
              <Upload className="size-4"/>
              Bulk Issue
            </Button>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="size-4"/>
              Issue Certificate
            </Button>
          </div>
        </div>
        <AdminDataTable
          columns={columns}
          rows={filteredCerts}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by name, ID, or event..."
          exportFileName="cpccu-certificates.csv"
          emptyText="No certificates found"
          toolbar={<Select value={placementFilter} onValueChange={setPlacementFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Placement"/>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Placements</SelectItem>
              <SelectItem value="1st">1st Place</SelectItem>
              <SelectItem value="2nd">2nd Place</SelectItem>
              <SelectItem value="3rd">3rd Place</SelectItem>
              <SelectItem value="participant">Participant</SelectItem>
              <SelectItem value="completion">Completion</SelectItem>
            </SelectContent>
          </Select>}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCert ? 'Edit Certificate' : 'Issue New Certificate'}</DialogTitle>
            <DialogDescription>
              {editingCert ? 'Update certificate details' : 'Fill in the details to issue a new certificate'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Recipient Name</Label>
              <Input value={formData.recipientName} onChange={(e) => setFormData((prev) => ({ ...prev, recipientName: e.target.value }))} placeholder="Enter recipient's full name"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Student ID</Label>
              <Input value={formData.recipientStudentId} onChange={(e) => setFormData((prev) => ({ ...prev, recipientStudentId: e.target.value }))} placeholder="e.g. 2022-1-60-001"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Event Name</Label>
              <Input value={formData.eventName} onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))} placeholder="e.g. CPCCU Contest 3"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Placement</Label>
              <Select value={formData.placement} onValueChange={(v) => setFormData((prev) => ({ ...prev, placement: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st">1st Place</SelectItem>
                  <SelectItem value="2nd">2nd Place</SelectItem>
                  <SelectItem value="3rd">3rd Place</SelectItem>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="completion">Completion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCert ? 'Update' : 'Issue Certificate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Issue Certificates</DialogTitle>
            <DialogDescription>
              Paste CSV rows as name, student ID, event name, placement.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="bulk-csv">Certificate CSV</Label>
            <Textarea
              id="bulk-csv"
              value={bulkCsv}
              onChange={(event) => setBulkCsv(event.target.value)}
              rows={8}
              placeholder={'recipientName,recipientId,contestName,placement\nRahul Roy Nipon,2022-1-60-001,CPCCU Contest 3,1st'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkIssue} disabled={!bulkCsv.trim()}>Issue Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
