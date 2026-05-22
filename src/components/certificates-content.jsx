'use client';
import { useEffect, useState } from 'react';
import { Search, Plus, MoreHorizontal, Award, Edit2, Trash2, Eye, Download, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { demoCertificates } from '@/lib/demo-data';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import { useCreateAdminCertificateMutation, useDeleteAdminCertificateMutation, useGetAdminCertificatesQuery, useUpdateAdminCertificateMutation } from '@/features/admin/adminApi';
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
    const [editingCert, setEditingCert] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Issued Certificates</CardTitle>
              <CardDescription>Manage all certificates issued by CPCCU</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 size-4"/>
              Issue Certificate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search by name, ID, or event..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9"/>
            </div>
            <Select value={placementFilter} onValueChange={setPlacementFilter}>
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
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificate ID</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCerts.length === 0 ? (<TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No certificates found
                    </TableCell>
                  </TableRow>) : (filteredCerts.map((cert) => (<TableRow key={cert.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                            {cert.certificateId}
                          </code>
                          <Button variant="ghost" size="icon" className="size-6" onClick={() => handleCopyId(cert.certificateId)}>
                            {copiedId === cert.certificateId ? (<Check className="size-3 text-green-500"/>) : (<Copy className="size-3"/>)}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{cert.recipientName}</TableCell>
                      <TableCell className="text-muted-foreground">{cert.recipientStudentId}</TableCell>
                      <TableCell>{cert.eventName}</TableCell>
                      <TableCell>
                        <Badge variant={placementConfig[cert.placement].variant}>
                          {placementConfig[cert.placement].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(cert.issuedAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
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
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>)))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
    </div>);
}
