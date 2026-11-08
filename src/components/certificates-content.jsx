'use client';
import { useEffect, useState } from 'react';
import { Plus, MoreHorizontal, Award, Edit2, Trash2, Eye, Download, Copy, Check, Upload, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { showSuccessAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import { isValidStudentId, detectScientificNotation, normalizeStudentId } from '@/lib/id-validation';
import { getCertificatesFromResponse } from '@/lib/certificates';
import * as XLSX from 'xlsx';
import {
    useCreateAdminCertificateMutation,
    useCreateAdminCertificateOptionMutation,
    useDeleteAdminCertificateMutation,
    useGetAdminCertificateOptionsQuery,
    useGetAdminCertificatesQuery,
    useUpdateAdminCertificateMutation
} from '@/features/admin/adminApi';
import { AdminDataTable } from '@/components/admin-data-table';
const placementConfig = {
    '1st': { label: '1st Place', variant: 'default' },
    '2nd': { label: '2nd Place', variant: 'secondary' },
    '3rd': { label: '3rd Place', variant: 'outline' },
    participant: { label: 'Participant', variant: 'outline' },
    completion: { label: 'Completion', variant: 'outline' },
    organizer: { label: 'Organizer', variant: 'secondary' },
};

const formatPlacementLabel = (value) => {
    if (!value) return '';
    if (placementConfig[value]) return placementConfig[value].label;
    return value
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

const getPlacementBadgeVariant = (placement) => {
    return placementConfig[placement]?.variant || 'outline';
};
const CONTEST_TYPE_LABELS = {
    'programming-contest': 'Programming Contest',
    hackathon: 'Hackathon',
    workshop: 'Workshop',
    'article-writing': 'Article Writing Contest',
};

const formatContestTypeLabel = (value) => {
    if (!value) return '';
    if (CONTEST_TYPE_LABELS[value]) return CONTEST_TYPE_LABELS[value];
    return value
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};
export function CertificatesContent() {
    const [certificates, setCertificates] = useState([]);
    const { data: certificatesResponse } = useGetAdminCertificatesQuery();
    const { data: certificateOptionsResponse } = useGetAdminCertificateOptionsQuery();
    const [createCertificate] = useCreateAdminCertificateMutation();
    const [updateCertificate] = useUpdateAdminCertificateMutation();
    const [deleteCertificate] = useDeleteAdminCertificateMutation();
    const [createCertificateOption] = useCreateAdminCertificateOptionMutation();
    const [searchQuery, setSearchQuery] = useState('');
    const [placementFilter, setPlacementFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [editingCert, setEditingCert] = useState(null);
    const [copiedId, setCopiedId] = useState(null);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkFileRows, setBulkFileRows] = useState([]);
    const [bulkFileMeta, setBulkFileMeta] = useState(null);
    const [bulkValidationErrors, setBulkValidationErrors] = useState([]);
    const [bulkSuccessSummary, setBulkSuccessSummary] = useState(null);
    const [idValidationError, setIdValidationError] = useState('');
    const [customPlacements, setCustomPlacements] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('cpccu_custom_placements');
                if (saved) return JSON.parse(saved);
            } catch {}
        }
        return [{ value: 'organizer', label: 'Organizer' }];
    });
    const [isAddingPlacement, setIsAddingPlacement] = useState(false);
    const [newPlacementName, setNewPlacementName] = useState('');
    const [customContestTypes, setCustomContestTypes] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('cpccu_custom_contest_types');
                if (saved) return JSON.parse(saved);
            } catch {}
        }
        return [];
    });
    const [isAddingContestType, setIsAddingContestType] = useState(false);
    const [newContestTypeName, setNewContestTypeName] = useState('');
    const [formData, setFormData] = useState({
        recipientName: '',
        recipientStudentId: '',
        eventName: '',
        placement: '1st',
        contestType: 'programming-contest',
        batch: '',
    });
    // Sync certificate options directly from MongoDB database
    useEffect(() => {
        const optData = certificateOptionsResponse?.data;
        if (optData) {
            if (Array.isArray(optData.customPlacements) && optData.customPlacements.length > 0) {
                setCustomPlacements((prev) => {
                    const map = new Map(prev.map((p) => [p.value, p]));
                    optData.customPlacements.forEach((p) => {
                        map.set(p.value, { value: p.value, label: p.label || formatPlacementLabel(p.value), id: p.id });
                    });
                    return Array.from(map.values());
                });
            }
            if (Array.isArray(optData.customContestTypes) && optData.customContestTypes.length > 0) {
                setCustomContestTypes((prev) => {
                    const map = new Map(prev.map((t) => [t.value, t]));
                    optData.customContestTypes.forEach((t) => {
                        map.set(t.value, { value: t.value, label: t.label || formatContestTypeLabel(t.value), id: t.id });
                    });
                    return Array.from(map.values());
                });
            }
        }
    }, [certificateOptionsResponse]);

    useEffect(() => {
        const certData = getCertificatesFromResponse(certificatesResponse);
        if (certData.length > 0) {
            setCertificates(certData.map((certificate) => {
                let placement = certificate.certificateType;
                if (certificate.certificateType === 'runner-up') placement = '2nd';
                else if (certificate.certificateType === '2nd-runner-up') placement = '3rd';
                else if (certificate.certificateType === 'participation') placement = 'participant';
                else if (certificate.certificateType === 'winner') placement = '1st';
                else placement = certificate.certificateType || '1st';

                return {
                    id: certificate._id,
                    certificateId: certificate.certificateId,
                    recipientName: certificate.recipientName,
                    recipientStudentId: certificate.recipientId,
                    eventName: certificate.contestName,
                    contestType: certificate.contestType,
                    batch: certificate.batch || '',
                    placement,
                    issuedAt: certificate.issueDate,
                    verificationUrl: `/certificate/${certificate.certificateId}`,
                };
            }));

            // Sync any custom placement types found in certificates
            const foundCustom = [];
            certData.forEach((c) => {
                const type = c.certificateType?.toLowerCase();
                if (type && !['runner-up', '2nd-runner-up', 'participation', 'winner', '1st', '2nd', '3rd', 'participant', 'completion'].includes(type)) {
                    foundCustom.push(type);
                }
            });
            if (foundCustom.length > 0) {
                setCustomPlacements((prev) => {
                    const existing = new Set(prev.map((p) => p.value));
                    const additions = foundCustom
                        .filter((val) => !existing.has(val))
                        .map((val) => ({ value: val, label: formatPlacementLabel(val) }));
                    const next = additions.length > 0 ? [...prev, ...additions] : prev;
                    try {
                        localStorage.setItem('cpccu_custom_placements', JSON.stringify(next));
                    } catch {}
                    return next;
                });
            }

            // Sync any custom contest types found in certificates
            const foundContestTypes = [];
            certData.forEach((c) => {
                const type = c.contestType?.toLowerCase();
                if (type && !['programming-contest', 'hackathon', 'workshop', 'article-writing'].includes(type)) {
                    foundContestTypes.push(type);
                }
            });
            if (foundContestTypes.length > 0) {
                setCustomContestTypes((prev) => {
                    const existing = new Set(prev.map((t) => t.value));
                    const additions = foundContestTypes
                        .filter((val) => !existing.has(val))
                        .map((val) => ({ value: val, label: formatContestTypeLabel(val) }));
                    const next = additions.length > 0 ? [...prev, ...additions] : prev;
                    try {
                        localStorage.setItem('cpccu_custom_contest_types', JSON.stringify(next));
                    } catch {}
                    return next;
                });
            }
        }
    }, [certificatesResponse]);
    const filteredCerts = certificates.filter((cert) => {
        const matchesSearch = cert.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.certificateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.recipientStudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.eventName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlacement = placementFilter === 'all' || cert.placement === placementFilter;
        return matchesSearch && matchesPlacement;
    }).sort((a, b) => a.certificateId.localeCompare(b.certificateId));
    const stats = {
        total: certificates.length,
        firstPlace: certificates.filter((c) => c.placement === '1st').length,
        secondPlace: certificates.filter((c) => c.placement === '2nd').length,
        thirdPlace: certificates.filter((c) => c.placement === '3rd').length,
    };
    const getNextCertificateNumber = () => {
        const currentYear = new Date().getFullYear();
        const yearCerts = certificates.filter((cert) => {
            const match = cert.certificateId.match(/^CPCCU-(\d{4})-(\d+)$/);
            return match && match[1] === String(currentYear);
        });
        let maxNum = 0;
        yearCerts.forEach((cert) => {
            const match = cert.certificateId.match(/^CPCCU-\d{4}-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        return maxNum + 1;
    };
    const generateCertificateId = () => {
        const year = new Date().getFullYear();
        const num = String(getNextCertificateNumber()).padStart(5, '0');
        return `CPCCU-${year}-${num}`;
    };
    const downloadBulkTemplate = () => {
        const headers = ['recipientName', 'recipientId', 'contestName', 'placement', 'contestType', 'batch'];
        const exampleRow = ['Rahul Roy Nipon', '02725205101015', 'CPCCU Contest 3', '1st', 'programming-contest', '2022'];
        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
        const numericColIndex = headers.indexOf('recipientId');
        if (numericColIndex >= 0) {
            const colLetter = XLSX.utils.encode_col(numericColIndex);
            ws['!cols'] = ws['!cols'] || [];
            ws['!cols'][numericColIndex] = ws['!cols'][numericColIndex] || {};
            ws['!cols'][numericColIndex].t = 's';
            ws['!cols'][numericColIndex].z = '@';
        }
        ws['!cols'] = ws['!cols'] || [];
        headers.forEach((_, i) => {
            if (!ws['!cols'][i]) ws['!cols'][i] = {};
            ws['!cols'][i].wch = 28;
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bulk Issue');
        const xlsxFile = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([xlsxFile], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cpccu-bulk-issue-template.xlsx';
        link.click();
        URL.revokeObjectURL(url);
    };
    const parseXlsxFile = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const wb = XLSX.read(data, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    resolve(json);
                } catch (err) {
                    reject(new Error('Failed to parse XLSX file. Please ensure it is a valid Excel file.'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read XLSX file.'));
            reader.readAsArrayBuffer(file);
        });
    };
    const handleXlsxUpload = async (file) => {
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setBulkValidationErrors([{ type: 'file', message: 'Only .xlsx files are supported.' }]);
            setBulkFile(null);
            setBulkFileRows([]);
            setBulkFileMeta(null);
            return;
        }
        try {
            const rows = await parseXlsxFile(file);
            const trimmed = rows.map((r) => r.map((c) => String(c).trim())).filter((r) => r.some((c) => c));
            if (trimmed.length === 0) {
                setBulkValidationErrors([{ type: 'file', message: 'The uploaded file contains no data rows.' }]);
                setBulkFile(null);
                setBulkFileRows([]);
                setBulkFileMeta(null);
                return;
            }
            const headerRow = trimmed[0].map((c) => c.toLowerCase());
            const hasHeader = headerRow.some((h) => ['recipientid', 'recipientname', 'recipient_id', 'recipient_name'].includes(h));
            const dataRows = hasHeader ? trimmed.slice(1) : trimmed;
            setBulkFile(file);
            setBulkFileMeta({ name: file.name, size: file.size, rowCount: dataRows.length });
            setBulkFileRows(dataRows);
            setBulkValidationErrors([]);
            setBulkSuccessSummary(null);
        } catch (err) {
            setBulkValidationErrors([{ type: 'file', message: 'Unable to read the XLSX file. Please download a fresh template and try again.' }]);
            setBulkFile(null);
            setBulkFileRows([]);
            setBulkFileMeta(null);
        }
    };

    const handleXlsxInputChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) await handleXlsxUpload(file);
        e.target.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file) await handleXlsxUpload(file);
    };
    const handleAddCustomPlacement = async () => {
        const trimmed = newPlacementName.trim();
        if (!trimmed) {
            showSuccessAlert('Invalid Name', 'Please enter a placement name.');
            return;
        }
        const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
        const label = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

        setCustomPlacements((prev) => {
            const next = prev.some((p) => p.value === slug) ? prev : [...prev, { value: slug, label }];
            try {
                localStorage.setItem('cpccu_custom_placements', JSON.stringify(next));
            } catch {}
            return next;
        });

        setFormData((prev) => ({ ...prev, placement: slug }));
        setNewPlacementName('');
        setIsAddingPlacement(false);

        // Persist to Database so all admins see it
        try {
            await createCertificateOption({ category: 'placement', label, value: slug }).unwrap();
        } catch (err) {
            console.error('Failed to save placement to database:', err);
        }
    };

    const handleAddCustomContestType = async () => {
        const trimmed = newContestTypeName.trim();
        if (!trimmed) {
            showSuccessAlert('Invalid Name', 'Please enter a contest type name.');
            return;
        }
        const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
        const label = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

        setCustomContestTypes((prev) => {
            const next = prev.some((t) => t.value === slug) ? prev : [...prev, { value: slug, label }];
            try {
                localStorage.setItem('cpccu_custom_contest_types', JSON.stringify(next));
            } catch {}
            return next;
        });

        setFormData((prev) => ({ ...prev, contestType: slug }));
        setNewContestTypeName('');
        setIsAddingContestType(false);

        // Persist to Database so all admins see it
        try {
            await createCertificateOption({ category: 'contestType', label, value: slug }).unwrap();
        } catch (err) {
            console.error('Failed to save contest type to database:', err);
        }
    };

    const handleOpenDialog = (cert) => {
        setIsAddingPlacement(false);
        setNewPlacementName('');
        setIsAddingContestType(false);
        setNewContestTypeName('');
        if (cert) {
            setEditingCert(cert);
            if (cert.placement && !['1st', '2nd', '3rd', 'participant', 'completion'].includes(cert.placement)) {
                setCustomPlacements((prev) => {
                    if (prev.some((p) => p.value === cert.placement)) return prev;
                    return [...prev, { value: cert.placement, label: formatPlacementLabel(cert.placement) }];
                });
            }
            if (cert.contestType && !['programming-contest', 'hackathon', 'workshop', 'article-writing'].includes(cert.contestType)) {
                setCustomContestTypes((prev) => {
                    if (prev.some((t) => t.value === cert.contestType)) return prev;
                    return [...prev, { value: cert.contestType, label: formatContestTypeLabel(cert.contestType) }];
                });
            }
            setFormData({
                recipientName: cert.recipientName,
                recipientStudentId: normalizeStudentId(cert.recipientStudentId),
                eventName: cert.eventName,
                placement: cert.placement,
                contestType: cert.contestType || 'programming-contest',
                batch: cert.batch || '',
            });
        }
        else {
            setEditingCert(null);
            setFormData({
                recipientName: '',
                recipientStudentId: '',
                eventName: '',
                placement: '1st',
                contestType: 'programming-contest',
                batch: '',
            });
        }
        setDialogOpen(true);
    };
    const handleSave = async () => {
        const trimmedId = normalizeStudentId(formData.recipientStudentId);
        if (detectScientificNotation(trimmedId)) {
            showSuccessAlert('Invalid Student ID', 'Student ID cannot be in scientific notation. Please re-enter the full ID.');
            return;
        }
        if (!isValidStudentId(trimmedId)) {
            showSuccessAlert('Invalid Student ID', 'Student ID must be digits only (6–20 characters, no symbols or spaces).');
            return;
        }
        if (!formData.eventName.trim()) {
            showSuccessAlert('Missing Event', 'Please enter the event name.');
            return;
        }
        const certificateType = formData.placement === '2nd'
            ? 'runner-up'
            : formData.placement === '3rd'
                ? '2nd-runner-up'
                : formData.placement === 'participant' || formData.placement === 'completion'
                    ? 'participation'
                    : formData.placement === '1st'
                        ? 'winner'
                        : formData.placement.toLowerCase();
        const payload = {
            recipientName: formData.recipientName,
            recipientId: trimmedId,
            contestName: formData.eventName,
            contestType: formData.contestType,
            certificateType,
            issueDate: new Date().toISOString(),
            description: `${formData.recipientName} received a CPCCU certificate for ${formData.eventName}.`,
            batch: formData.batch,
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
        const certificateWindow = window.open(`/certificate/${certificateId}`, '_blank');
        if (shouldPrint && certificateWindow) {
            certificateWindow.addEventListener('load', () => certificateWindow.print());
        }
    };
    const CONTEST_TYPE_MAP = {
        'programming contest': 'programming-contest',
        'programming-contest': 'programming-contest',
        'article writing': 'article-writing',
        'article-writing': 'article-writing',
        'hackathon': 'hackathon',
        'workshop': 'workshop',
    };
    const normalizeContestType = (raw) => {
        const key = String(raw || '').trim().toLowerCase();
        if (!key) return 'programming-contest';
        return CONTEST_TYPE_MAP[key] || key.replace(/\s+/g, '-');
    };
    const handleBulkIssue = async () => {
        const rows = bulkFileRows;
        const validRows = [];
        const errors = [];
        rows.forEach((row, idx) => {
            const rowNumber = idx + 2;
            const [recipientName, recipientIdRaw, contestName, placement = 'participant', contestType = 'programming-contest', batch = ''] = row;
            if (!recipientName || !recipientName.trim()) {
                errors.push({ row: rowNumber, field: 'name', message: 'Recipient name is required.' });
                return;
            }
            const trimmedId = normalizeStudentId(recipientIdRaw);
            if (!trimmedId) {
                errors.push({ row: rowNumber, field: 'id', message: `Student ID is required for "${recipientName.trim()}".` });
                return;
            }
            if (detectScientificNotation(trimmedId)) {
                errors.push({ row: rowNumber, field: 'id', message: `Student ID "${trimmedId}" for "${recipientName.trim()}" is in scientific notation. Re-enter the full ID.` });
                return;
            }
            if (!isValidStudentId(trimmedId)) {
                errors.push({ row: rowNumber, field: 'id', message: `Student ID "${trimmedId}" for "${recipientName.trim()}" must be digits only (6–20 characters, no symbols or spaces).` });
                return;
            }
            if (!contestName || !contestName.trim()) {
                errors.push({ row: rowNumber, field: 'event', message: `Event name is required for "${recipientName.trim()}".` });
                return;
            }
            validRows.push({ recipientId: trimmedId, recipientName: recipientName.trim(), contestName: contestName.trim(), placement, contestType: normalizeContestType(contestType), batch: String(batch).trim() });
        });
        setBulkValidationErrors(errors);
        if (errors.length > 0) {
            return;
        }
        if (validRows.length === 0) {
            setBulkValidationErrors([{ row: null, field: 'file', message: 'No valid data rows found to process.' }]);
            return;
        }

        const currentYear = new Date().getFullYear();
        const baseNum = getNextCertificateNumber();
        const rowsWithIds = validRows.map((row, index) => ({
            ...row,
            certificateId: `CPCCU-${currentYear}-${String(baseNum + index).padStart(5, '0')}`,
        }));

        const issued = [];
        const skipped = [];
        for (const row of rowsWithIds) {
            const rawPlacement = String(row.placement || '').trim().toLowerCase();
            let certificateType = 'participation';
            if (rawPlacement.includes('2nd runner') || rawPlacement.includes('2nd-runner') || rawPlacement.includes('3rd') || rawPlacement === '3') {
                certificateType = '2nd-runner-up';
            } else if (rawPlacement.includes('runner') || rawPlacement.includes('2nd') || rawPlacement === '2') {
                certificateType = 'runner-up';
            } else if (rawPlacement.includes('winner') || rawPlacement.includes('1st') || rawPlacement === '1' || rawPlacement.includes('champion')) {
                certificateType = 'winner';
            } else if (rawPlacement.includes('participant') || rawPlacement.includes('completion')) {
                certificateType = 'participation';
            } else if (rawPlacement) {
                certificateType = rawPlacement.replace(/\s+/g, '-');
            }

            // Sync any new placement or contestType to database, local state and localStorage
            if (certificateType && !['runner-up', '2nd-runner-up', 'participation', 'winner'].includes(certificateType)) {
                setCustomPlacements((prev) => {
                    const next = prev.some((p) => p.value === certificateType) ? prev : [...prev, { value: certificateType, label: formatPlacementLabel(certificateType) }];
                    try {
                        localStorage.setItem('cpccu_custom_placements', JSON.stringify(next));
                    } catch {}
                    return next;
                });
                createCertificateOption({
                    category: 'placement',
                    label: formatPlacementLabel(certificateType),
                    value: certificateType,
                }).catch(() => {});
            }
            if (row.contestType && !['programming-contest', 'hackathon', 'workshop', 'article-writing'].includes(row.contestType)) {
                setCustomContestTypes((prev) => {
                    const next = prev.some((t) => t.value === row.contestType) ? prev : [...prev, { value: row.contestType, label: formatContestTypeLabel(row.contestType) }];
                    try {
                        localStorage.setItem('cpccu_custom_contest_types', JSON.stringify(next));
                    } catch {}
                    return next;
                });
                createCertificateOption({
                    category: 'contestType',
                    label: formatContestTypeLabel(row.contestType),
                    value: row.contestType,
                }).catch(() => {});
            }

            try {
                await createCertificate({
                    certificateId: row.certificateId,
                    recipientName: row.recipientName,
                    recipientId: row.recipientId,
                    contestName: row.contestName,
                    contestType: row.contestType,
                    certificateType,
                    issueDate: new Date().toISOString(),
                    description: `${row.recipientName} received a CPCCU certificate for ${row.contestName}.`,
                    batch: row.batch,
                }).unwrap();
                issued.push(row);
            } catch (err) {
                console.error(`Failed to issue ${row.certificateId}:`, err);
                skipped.push({ ...row, reason: err?.data?.message || 'Server error' });
            }
        }
        setBulkSuccessSummary({ total: validRows.length, issued: issued.length, skipped: skipped.length });
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
            key: 'contestType',
            header: 'Type',
            accessor: 'contestType',
            cell: (cert) => <span className="text-xs font-semibold px-2 py-1 bg-primary/10 rounded-md">{formatContestTypeLabel(cert.contestType)}</span>,
        },
        { key: 'batch', header: 'Batch', accessor: 'batch', cellClassName: 'text-muted-foreground' },
        {
            key: 'placement',
            header: 'Placement',
            accessor: 'placement',
            cell: (cert) => <Badge variant={getPlacementBadgeVariant(cert.placement)}>{formatPlacementLabel(cert.placement)}</Badge>,
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
              {customPlacements.map((cp) => (
                <SelectItem key={cp.value} value={cp.value}>
                  {cp.label}
                </SelectItem>
              ))}
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
              <Input
                value={formData.recipientStudentId}
                onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => ({ ...prev, recipientStudentId: val }));
                    if (!val) { setIdValidationError(''); return; }
                    if (detectScientificNotation(val)) {
                        setIdValidationError('ID contains scientific notation – please enter the full number.');
                    }
                    else if (val.trim() && !isValidStudentId(val)) {
                        setIdValidationError('Student ID must be digits only (6–20 characters, no spaces or symbols).');
                    }
                    else {
                        setIdValidationError('');
                    }
                }}
                placeholder="e.g. 02725205101015"
              />
              {idValidationError && <p className="text-xs font-semibold text-red-600">{idValidationError}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Event Name</Label>
              <Input value={formData.eventName} onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))} placeholder="e.g. CPCCU Contest 3"/>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Contest Type</Label>
                {!isAddingContestType && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary hover:text-primary/80 font-medium"
                    onClick={() => setIsAddingContestType(true)}
                  >
                    <Plus className="mr-1 size-3" />
                    Add Contest Type
                  </Button>
                )}
              </div>

              {isAddingContestType ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5">
                  <Input
                    value={newContestTypeName}
                    onChange={(e) => setNewContestTypeName(e.target.value)}
                    placeholder="Enter contest type (e.g. Bootcamp)"
                    className="h-8 text-xs bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomContestType();
                      } else if (e.key === 'Escape') {
                        setIsAddingContestType(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold"
                    onClick={handleAddCustomContestType}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setIsAddingContestType(false);
                      setNewContestTypeName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.contestType}
                  onValueChange={(v) => {
                    if (v === '__add_new__') {
                      setIsAddingContestType(true);
                    } else {
                      setFormData((prev) => ({ ...prev, contestType: v }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contest type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programming-contest">Programming Contest</SelectItem>
                    <SelectItem value="hackathon">Hackathon</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="article-writing">Article Writing Contest</SelectItem>
                    {customContestTypes.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {ct.label}
                      </SelectItem>
                    ))}
                    <div className="p-1 border-t border-border/60 mt-1">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsAddingContestType(true);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-primary rounded-md hover:bg-primary/10 transition-colors cursor-pointer text-left"
                      >
                        <Plus className="size-3.5" />
                        + Add New Contest Type
                      </button>
                    </div>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Batch</Label>
              <Input value={formData.batch} onChange={(e) => setFormData((prev) => ({ ...prev, batch: e.target.value }))} placeholder="e.g. 2022, 2023"/>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Placement</Label>
                {!isAddingPlacement && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary hover:text-primary/80 font-medium"
                    onClick={() => setIsAddingPlacement(true)}
                  >
                    <Plus className="mr-1 size-3" />
                    Add Placement
                  </Button>
                )}
              </div>

              {isAddingPlacement ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5">
                  <Input
                    value={newPlacementName}
                    onChange={(e) => setNewPlacementName(e.target.value)}
                    placeholder="Enter placement (e.g. Organizer)"
                    className="h-8 text-xs bg-background"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomPlacement();
                      } else if (e.key === 'Escape') {
                        setIsAddingPlacement(false);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold"
                    onClick={handleAddCustomPlacement}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setIsAddingPlacement(false);
                      setNewPlacementName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.placement}
                  onValueChange={(v) => {
                    if (v === '__add_new__') {
                      setIsAddingPlacement(true);
                    } else {
                      setFormData((prev) => ({ ...prev, placement: v }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select placement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st">1st Place</SelectItem>
                    <SelectItem value="2nd">2nd Place</SelectItem>
                    <SelectItem value="3rd">3rd Place</SelectItem>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="completion">Completion</SelectItem>
                    {customPlacements.map((cp) => (
                      <SelectItem key={cp.value} value={cp.value}>
                        {cp.label}
                      </SelectItem>
                    ))}
                    <div className="p-1 border-t border-border/60 mt-1">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsAddingPlacement(true);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-primary rounded-md hover:bg-primary/10 transition-colors cursor-pointer text-left"
                      >
                        <Plus className="size-3.5" />
                        + Add New Placement
                      </button>
                    </div>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCert ? 'Update' : 'Issue Certificate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (!open) {
              setBulkFile(null);
              setBulkFileRows([]);
              setBulkFileMeta(null);
              setBulkValidationErrors([]);
              setBulkSuccessSummary(null);
          }
      }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Bulk Issue Certificates</DialogTitle>
            <DialogDescription>
              Issue multiple certificates by uploading a completed XLSX file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 1</p>
              <Button variant="outline" onClick={downloadBulkTemplate} className="gap-2 w-fit">
                <FileSpreadsheet className="size-4" />
                Download XLSX Template
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 2</p>
              <p className="text-sm text-muted-foreground">Fill the template with student data, save, then upload below.</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 3</p>
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted/20 px-6 py-10 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/40"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('bulk-xlsx-input')?.click()}
              >
                <FileSpreadsheet className="size-10 text-muted-foreground" />
                <p className="text-sm font-semibold text-gray-700">Drag & drop your XLSX file here</p>
                <p className="text-xs text-muted-foreground">or</p>
                <Button variant="secondary" size="sm" type="button" onClick={(e) => e.stopPropagation()}>
                  Browse Files
                </Button>
                <input
                  id="bulk-xlsx-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleXlsxInputChange}
                />
              </div>
            </div>
            {bulkFileMeta && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <FileSpreadsheet className="size-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-800">{bulkFileMeta.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(bulkFileMeta.size / 1024).toFixed(1)} KB • {bulkFileMeta.rowCount} rows detected
                    </span>
                  </div>
                </div>
                {!bulkSuccessSummary && (
                  <span className="text-xs font-semibold text-green-600">Ready to issue</span>
                )}
              </div>
            )}
            {bulkValidationErrors.length > 0 && !bulkSuccessSummary && (
              <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">
                  {bulkValidationErrors.length} row(s) contain invalid data:
                </p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {bulkValidationErrors.slice(0, 20).map((err, i) => (
                    <span key={i} className="text-xs text-red-600">
                      Row {err.row ?? '?'}: {err.message}
                    </span>
                  ))}
                  {bulkValidationErrors.length > 20 && (
                    <span className="text-xs text-red-500">...and {bulkValidationErrors.length - 20} more.</span>
                  )}
                </div>
              </div>
            )}
            {bulkSuccessSummary && (
              <div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-bold text-green-800">Certificates Issued Successfully</p>
                <p className="text-xs text-green-700">
                  Total Rows: {bulkSuccessSummary.total} • Issued: {bulkSuccessSummary.issued} • Skipped: {bulkSuccessSummary.skipped}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
                setBulkDialogOpen(false);
                setBulkFile(null);
                setBulkFileRows([]);
                setBulkFileMeta(null);
                setBulkValidationErrors([]);
                setBulkSuccessSummary(null);
            }}>Cancel</Button>
            <Button
              onClick={() => {
                  if (bulkValidationErrors.length === 0 && bulkFileRows.length > 0) {
                      handleBulkIssue();
                  }
              }}
              disabled={!bulkFile || bulkFileRows.length === 0 || bulkValidationErrors.length > 0 || !!bulkSuccessSummary}
              className="gap-2"
            >
              {bulkSuccessSummary ? 'Issued' : 'Issue Certificates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
  }
