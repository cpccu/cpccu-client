'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, MoreHorizontal, Award, Edit2, Trash2, Eye, Download, Copy, Check, Upload, FileSpreadsheet, Trophy, AlertTriangle, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { showSuccessAlert, showErrorAlert, showDeleteConfirm } from '@/lib/alerts';
import { formatDate } from '@/lib/format-date';
import { isValidStudentId, detectScientificNotation, normalizeStudentId } from '@/lib/id-validation';
import { getCertificatesFromResponse } from '@/lib/certificates';
import * as XLSX from 'xlsx';
import { useBulkIssueAdminCertificatesMutation, useCreateAdminCertificateMutation, useDeleteAdminCertificateMutation, useGetAdminCertificatesQuery, useGetAdminCertificateTemplatesQuery, useLazyGetAdminEventRankingsQuery, useSubmitAdminEventRankingsMutation, useUpdateAdminCertificateMutation } from '@/features/admin/adminApi';
import { useGetCertificateSignatoriesQuery } from '@/features/certificate/certificateApi';
import { AdminDataTable } from '@/components/admin-data-table';
import useAdminContent from '@/hooks/use-admin-content';
import { CertificateTemplatePicker } from '@/components/CERTIFICATE/certificate-template-preview';
import { EventCombobox } from '@/components/CERTIFICATE/event-combobox';
import { DownloadCertificateButton } from '@/components/CERTIFICATE/download-certificate-button';
import { CERTIFICATE_TEMPLATES, DEFAULT_CERTIFICATE_TEMPLATE_KEY, getClientTemplate } from '@/components/CERTIFICATE/templates/template-registry';

/**
 * The certificate type a sheet/file placement string maps to.
 *
 * Mirrors the server's `normalizePlacementToCertificateType`: an unrecognised
 * placement becomes `participation`, never a placing, so a typo cannot promote
 * a record.
 */
const placementToCertificateType = (placement) => {
    const normalized = String(placement || '').trim().toLowerCase();
    if (normalized === '1st' || normalized === 'winner') return 'winner';
    if (normalized === '2nd' || normalized === 'runner-up') return 'runner-up';
    if (normalized === '3rd' || normalized === '2nd-runner-up') return '2nd-runner-up';
    return 'participation';
};

/** The rank implied by a placement, or `null` for a plain participant. */
const placementToRank = (placement) => {
    const normalized = String(placement || '').trim().toLowerCase();
    if (normalized.startsWith('1')) return 1;
    if (normalized.startsWith('2')) return 2;
    if (normalized.startsWith('3')) return 3;
    return null;
};

/** 1 → winner, 2 → runner-up, 3 → 2nd-runner-up, 4+ → participation. */
const certificateTypeForRank = (rank) => {
    const parsed = Number(rank);
    if (parsed === 1) return 'winner';
    if (parsed === 2) return 'runner-up';
    if (parsed === 3) return '2nd-runner-up';
    return 'participation';
};

/**
 * Mirrors the server's `mapEventTypeToContestType`
 * (`cpccu-server/src/utils/certificateContestType.js`) so the dialog previews
 * exactly what the write will store. An unknown event type falls back to
 * `programming-contest`, the server's default.
 */
const EVENT_TYPE_TO_CONTEST_TYPE = {
    hackathon: 'hackathon',
    workshop: 'workshop',
    seminar: 'workshop',
    bootcamp: 'workshop',
    lecture: 'workshop',
    'programming-contest': 'programming-contest',
    contest: 'programming-contest',
    competition: 'programming-contest',
    coding: 'programming-contest',
    'article-writing': 'article-writing',
    article: 'article-writing',
    writing: 'article-writing',
};

const contestTypeForEvent = (event) => {
    const key = String(event?.type || '').trim().toLowerCase();
    return EVENT_TYPE_TO_CONTEST_TYPE[key] || 'programming-contest';
};

const placementConfig = {
    '1st': { label: '1st Place', variant: 'default' },
    '2nd': { label: '2nd Place', variant: 'secondary' },
    '3rd': { label: '3rd Place', variant: 'outline' },
    participant: { label: 'Participant', variant: 'outline' },
    completion: { label: 'Completion', variant: 'outline' },
};
const CONTEST_TYPE_LABELS = {
    'programming-contest': 'Programming Contest',
    hackathon: 'Hackathon',
    workshop: 'Workshop',
    'article-writing': 'Article Writing Contest',
};
const SIGNATORY_OPTIONS = [
    { key: 'president', label: 'President' },
    { key: 'vicePresident', label: 'Vice President' },
    { key: 'generalSecretary', label: 'General Secretary' },
    { key: 'treasurer', label: 'Treasurer' },
    { key: 'coordinator', label: 'Contest and Event Coordinator' },
];

function SignatorySelector({ value, onChange }) {
    const selected = Array.isArray(value) ? value : ['president', 'coordinator'];
    const toggle = (key) => {
        if (selected.includes(key)) {
            if (selected.length <= 1) return;
            onChange(selected.filter((k) => k !== key));
        } else {
            if (selected.length >= 3) return;
            onChange([...selected, key]);
        }
    };
    return (
        <div className="flex flex-col gap-2">
            <Label>Signatories</Label>
            <p className="text-xs text-muted-foreground">Select 1 to 3 signatories to appear on the certificate.</p>
            <div className="flex flex-col gap-2">
                {SIGNATORY_OPTIONS.map((opt) => {
                    const checked = selected.includes(opt.key);
                    const disabled = checked ? selected.length <= 1 : selected.length >= 3;
                    return (
                        <label key={opt.key} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() => toggle(opt.key)}
                            />
                            {opt.label}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

export function CertificatesContent() {
    const [certificates, setCertificates] = useState([]);
    const role = useSelector((state) => state.auth.user?.roles?.role);
    // ⚠️ THE MEMBER PDF DOWNLOAD IS ADMIN-ONLY. The endpoint that serves the
    // participation PDF re-checks the caller's role, and only an admin may
    // download somebody else's certificate — a moderator or a mentor gets a
    // 403. Offering the action anyway would only teach them that the panel is
    // broken. The server is still the gate; this only stops the UI from
    // promising something the server will refuse.
    const canDownloadMemberCertificate = role === 'admin';
    const { data: certificatesResponse } = useGetAdminCertificatesQuery();
    const [createCertificate] = useCreateAdminCertificateMutation();
    const [updateCertificate] = useUpdateAdminCertificateMutation();
    const [deleteCertificate] = useDeleteAdminCertificateMutation();
    const [bulkIssueCertificates, { isLoading: isBulkIssuing }] = useBulkIssueAdminCertificatesMutation();
    const [loadEventRankings, { isFetching: isLoadingRankings }] = useLazyGetAdminEventRankingsQuery();
    const [submitEventRankings, { isLoading: isSubmittingRankings }] = useSubmitAdminEventRankingsMutation();
    const { items: events } = useAdminContent('events', [], { limit: 200 });
    const { data: templatesResponse } = useGetAdminCertificateTemplatesQuery();
    const { data: signatoriesResponse } = useGetCertificateSignatoriesQuery();
    const committeeOptions = signatoriesResponse?.data?.committees || [];
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
    const [bulkEventId, setBulkEventId] = useState('');
    const [idValidationError, setIdValidationError] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);
    // A certificate PDF export runs after the click, and the download control
    // has to stay mounted while it does: unmounting it cancels the export, and
    // the admin is left with no file and no message.
    const [isDownloading, setIsDownloading] = useState(false);

    /**
     * Keeps the row's menu open for as long as its export runs.
     *
     * Closing the menu while an export is in flight would unmount the download
     * control, so the close is refused — and once the export is over the menu
     * is closed again, which also hands the page back: an open Radix menu
     * holds `pointer-events: none` on the body, and that would leave the
     * result alert unclickable.
     */
    const handleDownloadBusyChange = useCallback((busy) => {
        setIsDownloading(busy);
        if (!busy) {
            setOpenMenuId(null);
        }
    }, []);

    // ===== Event rankings → certificates =====
    const [rankingsEventId, setRankingsEventId] = useState('');
    const [rankingsTemplateKey, setRankingsTemplateKey] = useState(DEFAULT_CERTIFICATE_TEMPLATE_KEY);
    const [rankingsCommitteeKey, setRankingsCommitteeKey] = useState('');
    const [rankings, setRankings] = useState([]);
    const [rankingsMessage, setRankingsMessage] = useState(null);
    const [rankingsError, setRankingsError] = useState('');

    const defaultTemplateKey = templatesResponse?.data?.defaultKey || DEFAULT_CERTIFICATE_TEMPLATE_KEY;
    // The server registry is the source of truth for labels/palette; the local
    // registry is the fallback while the request is in flight.
    const templateOptions = useMemo(() => {
        const remote = templatesResponse?.data?.templates;
        return Array.isArray(remote) && remote.length > 0 ? remote : CERTIFICATE_TEMPLATES;
    }, [templatesResponse]);

    const eventsById = useMemo(() => {
        const map = new Map();
        events.forEach((event) => map.set(event.id, event));
        return map;
    }, [events]);

    const [formData, setFormData] = useState({
        recipientName: '',
        recipientStudentId: '',
        eventName: '',
        placement: '1st',
        contestType: 'programming-contest',
        batch: '',
        eventId: '',
        templateKey: DEFAULT_CERTIFICATE_TEMPLATE_KEY,
        committee: '',
        signatories: ['president', 'coordinator'],
    });

    const [bulkTemplateKey, setBulkTemplateKey] = useState(DEFAULT_CERTIFICATE_TEMPLATE_KEY);
    const [bulkCommitteeKey, setBulkCommitteeKey] = useState('');
    const [bulkSignatories, setBulkSignatories] = useState(['president', 'coordinator']);
    const [rankingsSignatories, setRankingsSignatories] = useState(['president', 'coordinator']);

    // The default template is only known after the template list arrives.
    useEffect(() => {
        setFormData((prev) => ({ ...prev, templateKey: prev.templateKey || defaultTemplateKey }));
        setBulkTemplateKey((prev) => prev || defaultTemplateKey);
        setRankingsTemplateKey((prev) => prev || defaultTemplateKey);
    }, [defaultTemplateKey]);
    useEffect(() => {
        const certData = getCertificatesFromResponse(certificatesResponse);
        // Set unconditionally: an empty response means the last certificate was
        // deleted, and keeping the old rows would show records that no longer exist.
        setCertificates(certData.map((certificate) => ({
                id: certificate._id,
                certificateId: certificate.certificateId,
                recipientName: certificate.recipientName,
                recipientId: certificate.recipientId,
                recipientStudentId: certificate.recipientId,
                eventId: certificate.eventId || '',
                eventName: certificate.contestName,
                contestName: certificate.contestName,
                contestType: certificate.contestType,
                certificateType: certificate.certificateType,
                templateKey: certificate.templateKey || DEFAULT_CERTIFICATE_TEMPLATE_KEY,
                committee: certificate.committee || '',
                signatories: certificate.signatories || ['president', 'coordinator'],
                rank: certificate.rank ?? null,
                description: certificate.description || '',
                issuedBy: certificate.issuedBy || '',
                issueDate: certificate.issueDate,
                batch: certificate.batch || '',
                placement: certificate.certificateType === 'runner-up'
                    ? '2nd'
                    : certificate.certificateType === '2nd-runner-up'
                        ? '3rd'
                        : certificate.certificateType === 'participation'
                            ? 'participant'
                            : '1st',
                issuedAt: certificate.issueDate,
                verificationUrl: `/certificate/${certificate.certificateId}`,
        })));
    }, [certificatesResponse]);
    const filteredCerts = certificates.filter((cert) => {
        const templateLabel = getClientTemplate(cert.templateKey)?.label || '';
        const eventTitle = eventsById.get(cert.eventId)?.title || '';
        const matchesSearch = cert.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.certificateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.recipientStudentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cert.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            templateLabel.toLowerCase().includes(searchQuery.toLowerCase());
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
        // A second sheet, NOT extra rows in the data sheet: the upload parser
        // reads every non-empty row of the first sheet as student data.
        const instructions = XLSX.utils.aoa_to_sheet([
            ['Column', 'Required?', 'Notes'],
            ['recipientName', 'Yes', 'Full name printed on the certificate.'],
            ['recipientId', 'Yes', 'University student ID — 6 to 20 digits, no spaces.'],
            ['contestName', 'When no event is picked', 'Ignored when an event is selected in the dialog; the server uses the event title.'],
            ['placement', 'No', '1st / 2nd / 3rd, or participant. Defaults to participant.'],
            ['contestType', 'When no event is picked', 'programming-contest / hackathon / workshop / article-writing.'],
            ['batch', 'No', 'Printed on the certificate when present.'],
        ]);
        instructions['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 70 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bulk Issue');
        XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');
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
    const handleOpenDialog = (cert) => {
        if (cert) {
            setEditingCert(cert);
            setFormData({
                recipientName: cert.recipientName,
                recipientStudentId: normalizeStudentId(cert.recipientStudentId),
                eventName: cert.eventName,
                placement: cert.placement,
                contestType: cert.contestType || 'programming-contest',
                batch: cert.batch || '',
                eventId: cert.eventId || '',
                templateKey: cert.templateKey || defaultTemplateKey,
                committee: cert.committee || '',
                signatories: cert.signatories || ['president', 'coordinator'],
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
                eventId: '',
                templateKey: defaultTemplateKey,
                committee: '',
                signatories: ['president', 'coordinator'],
            });
        }
        setIdValidationError('');
        setDialogOpen(true);
    };

    /**
     * Picking an event fills the contest name/type from it.
     *
     * The server does the same on write, so this is a preview of what will be
     * stored — not a second source of truth.
     */
    const handleFormEventChange = (eventId) => {
        const event = eventsById.get(eventId);
        setFormData((prev) => ({
            ...prev,
            eventId,
            eventName: event?.title || prev.eventName,
            contestType: event ? contestTypeForEvent(event) : prev.contestType,
        }));
    };
    const handleSave = async () => {
        const trimmedId = normalizeStudentId(formData.recipientStudentId);
        if (!formData.recipientName.trim()) {
            showErrorAlert('Missing Recipient', 'Please enter the recipient name.');
            return;
        }
        if (detectScientificNotation(trimmedId)) {
            showErrorAlert('Invalid Student ID', 'Student ID cannot be in scientific notation. Please re-enter the full ID.');
            return;
        }
        if (!isValidStudentId(trimmedId)) {
            showErrorAlert('Invalid Student ID', 'Student ID must be digits only (6–20 characters, no symbols or spaces).');
            return;
        }
        if (!formData.eventName.trim()) {
            showErrorAlert('Missing Event', 'Please enter the event name or link an event.');
            return;
        }
        const certificateType = placementToCertificateType(formData.placement);
        const payload = {
            recipientName: formData.recipientName.trim(),
            recipientId: trimmedId,
            contestName: formData.eventName.trim(),
            contestType: formData.contestType,
            certificateType,
            rank: placementToRank(formData.placement),
            issueDate: new Date().toISOString(),
            description: `${formData.recipientName.trim()} received a CPCCU certificate for ${formData.eventName.trim()}.`,
            batch: formData.batch,
            // `null` clears a previously linked event; the server whitelists
            // both fields on the PATCH and the create.
            eventId: formData.eventId || null,
            templateKey: formData.templateKey || defaultTemplateKey,
            committee: formData.committee || null,
            signatories: formData.signatories,
        };
        try {
            if (editingCert) {
                await updateCertificate({ id: editingCert.id, body: payload }).unwrap();
                showSuccessAlert('Updated!', 'Certificate updated successfully');
            }
            else {
                const newCertId = generateCertificateId();
                await createCertificate({ ...payload, certificateId: newCertId }).unwrap();
                showSuccessAlert('Issued!', 'Certificate issued successfully');
            }
            setDialogOpen(false);
        } catch (error) {
            console.error('Certificate save failed:', error);
            showErrorAlert('Could not save certificate', error?.data?.errors?.[0]?.message || error?.data?.message || 'Something went wrong. Please try again.');
        }
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
        return CONTEST_TYPE_MAP[key] || 'programming-contest';
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
            // The contest columns are optional whenever an event is selected:
            // the server derives the name and type from the event record.
            if (!bulkEventId && (!contestName || !contestName.trim())) {
                errors.push({ row: rowNumber, field: 'event', message: `Contest name is required for "${recipientName.trim()}" — either pick an event above or fill the contestName column.` });
                return;
            }
            validRows.push({
                recipientName: recipientName.trim(),
                recipientId: trimmedId,
                certificateType: placementToCertificateType(placement),
                rank: placementToRank(placement),
                batch: String(batch).trim(),
                contestName: contestName ? String(contestName).trim() : '',
                contestType: bulkEventId ? undefined : normalizeContestType(contestType),
            });
        });
        setBulkValidationErrors(errors);
        if (errors.length > 0) {
            return;
        }
        if (validRows.length === 0) {
            setBulkValidationErrors([{ row: null, field: 'file', message: 'No valid data rows found to process.' }]);
            return;
        }

        try {
            // ONE request for the whole batch. The server allocates the ids and
            // reports per-row skips instead of failing the batch.
            const response = await bulkIssueCertificates({
                eventId: bulkEventId || undefined,
                templateKey: bulkTemplateKey || defaultTemplateKey,
                committee: bulkCommitteeKey || null,
                signatories: bulkSignatories,
                rows: validRows,
            }).unwrap();

            const created = response?.data?.created || [];
            const skipped = response?.data?.skipped || [];
            setBulkSuccessSummary({
                total: validRows.length,
                issued: created.length,
                skipped: skipped.length,
                skipReasons: skipped.slice(0, 5).map((entry) => entry?.reason || 'Skipped'),
            });
        } catch (error) {
            console.error('Bulk issue failed:', error);
            const message = error?.data?.errors?.[0]?.message || error?.data?.message || 'The bulk issue request failed. Please try again.';
            setBulkValidationErrors([{ row: null, field: 'bulk', message }]);
        }
    };
    // ===== Bulk issue =====

    /**
     * Clears everything the bulk dialog remembers.
     *
     * Called on close as well as on cancel: a second open must not reuse the
     * previous file's rows or its success summary.
     */
    const resetBulkDialog = () => {
        setBulkFile(null);
        setBulkFileRows([]);
        setBulkFileMeta(null);
        setBulkValidationErrors([]);
        setBulkSuccessSummary(null);
        setBulkEventId('');
        setBulkTemplateKey(defaultTemplateKey);
        setBulkCommitteeKey('');
        setBulkSignatories(['president', 'coordinator']);
    };

    // ===== Event rankings → certificates =====

    const selectedRankingsEvent = rankingsEventId
        ? eventsById.get(rankingsEventId)
        : null;

    const eventEndsInFuture = Boolean(
        selectedRankingsEvent?.eventEndAt &&
        new Date(selectedRankingsEvent.eventEndAt).getTime() > Date.now()
    );

    const addRankingRow = () => {
        setRankings((prev) => [
            ...prev,
            {
                rank: prev.length + 1,
                recipientName: '',
                recipientUniId: '',
                certificateType: certificateTypeForRank(prev.length + 1),
            },
        ]);
        setRankingsError('');
        setRankingsMessage(null);
    };

    const updateRankingRow = (index, patch) => {
        setRankings((prev) =>
            prev.map((row, rowIndex) => {
                if (rowIndex !== index) return row;

                const next = { ...row, ...patch };

                // A type the admin picked by hand is kept; a type that was
                // still the rank's default follows the new rank.
                if (patch.rank !== undefined) {
                    const wasDefault =
                        !row.certificateType ||
                        row.certificateType === certificateTypeForRank(row.rank);
                    next.rank = patch.rank;
                    if (wasDefault) {
                        next.certificateType = certificateTypeForRank(Number(patch.rank));
                    }
                }

                return next;
            })
        );
    };

    const removeRankingRow = (index) => {
        setRankings((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    };

    const handleLoadRankings = async () => {
        if (!rankingsEventId) {
            showErrorAlert('Select an event', 'Pick an event before loading its rankings.');
            return;
        }

        setRankingsError('');
        setRankingsMessage(null);

        try {
            const response = await loadEventRankings(rankingsEventId).unwrap();
            const items = response?.data?.rankings;
            const rows = Array.isArray(items) ? items : [];

            setRankings(
                rows.map((ranking) => ({
                    rank: ranking.rank,
                    recipientName: ranking.recipientName || '',
                    recipientUniId: ranking.recipientUniId || '',
                    certificateType:
                        ranking.certificateType || certificateTypeForRank(ranking.rank),
                }))
            );
            setRankingsMessage(
                rows.length > 0
                    ? `Loaded ${rows.length} existing ranking row(s).`
                    : 'This event has no rankings yet — add the placings below.'
            );
        } catch (error) {
            console.error('Loading rankings failed:', error);
            showErrorAlert('Could not load rankings', error?.data?.message || 'Something went wrong. Please try again.');
        }
    };

    const handleGenerateRankings = async () => {
        if (!rankingsEventId) {
            showErrorAlert('Select an event', 'Pick the event these placings belong to.');
            return;
        }

        const errors = [];
        const seenRanks = new Set();

        rankings.forEach((row, index) => {
            const rank = Number(row.rank);
            const name = String(row.recipientName || '').trim();
            const uniId = normalizeStudentId(row.recipientUniId);

            if (!Number.isInteger(rank) || rank < 1) {
                errors.push(`Row ${index + 1}: rank must be a positive whole number.`);
            } else if (seenRanks.has(rank)) {
                errors.push(`Row ${index + 1}: rank ${rank} is already used.`);
            } else {
                seenRanks.add(rank);
            }

            if (!name) errors.push(`Row ${index + 1}: recipient name is required.`);
            if (detectScientificNotation(row.recipientUniId)) {
                errors.push(`Row ${index + 1}: student ID is in scientific notation.`);
            } else if (!isValidStudentId(uniId)) {
                errors.push(`Row ${index + 1}: student ID must be digits only (6–20 characters).`);
            }
        });

        setRankingsError(errors.join(' '));
        setRankingsMessage(null);

        if (errors.length > 0) return;

        if (rankings.length === 0) {
            setRankingsError('Add at least one ranking row before generating certificates.');
            return;
        }

        try {
            const response = await submitEventRankings({
                eventId: rankingsEventId,
                templateKey: rankingsTemplateKey || defaultTemplateKey,
                committee: rankingsCommitteeKey || null,
                signatories: rankingsSignatories,
                rankings: rankings.map((row) => ({
                    rank: Number(row.rank),
                    recipientName: String(row.recipientName).trim(),
                    recipientUniId: normalizeStudentId(row.recipientUniId),
                    certificateType: row.certificateType || certificateTypeForRank(Number(row.rank)),
                })),
            }).unwrap();

            const certificates = response?.data?.certificates || [];
            setRankingsMessage(
                certificates.length > 0
                    ? `Generated ${certificates.length} certificate(s): ${certificates
                        .slice(0, 5)
                        .map((certificate) => certificate.certificateId)
                        .join(', ')}${certificates.length > 5 ? '…' : ''}`
                    : 'Rankings saved, but no certificates were generated.'
            );
            showSuccessAlert(
                'Certificates generated',
                `${certificates.length} certificate(s) are now linked to this event.`
            );
        } catch (error) {
            console.error('Generating certificates failed:', error);
            const fieldError = error?.data?.errors?.[0]?.message;
            setRankingsError(fieldError || error?.data?.message || 'Something went wrong. Please try again.');
        }
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
        { key: 'eventName', header: 'Contest', accessor: 'eventName' },
        {
            key: 'contestType',
            header: 'Type',
            accessor: 'contestType',
            cell: (cert) => <span className="text-xs font-semibold px-2 py-1 bg-primary/10 rounded-md">{CONTEST_TYPE_LABELS[cert.contestType] || cert.contestType}</span>,
        },
        { key: 'batch', header: 'Batch', accessor: 'batch', cellClassName: 'text-muted-foreground' },
        {
            key: 'placement',
            header: 'Placement',
            accessor: 'placement',
            cell: (cert) => <Badge variant={placementConfig[cert.placement]?.variant || 'outline'}>{placementConfig[cert.placement]?.label || cert.placement}</Badge>,
        },
        {
            key: 'templateKey',
            header: 'Template',
            accessor: (cert) => getClientTemplate(cert.templateKey)?.label || cert.templateKey,
            cell: (cert) => <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-md">{getClientTemplate(cert.templateKey)?.label || cert.templateKey}</span>,
        },
        {
            key: 'eventId',
            header: 'Event',
            accessor: (cert) => eventsById.get(cert.eventId)?.title || '',
            cell: (cert) => {
                const eventTitle = eventsById.get(cert.eventId)?.title;
                if (!eventTitle) {
                    return <span className="text-xs text-muted-foreground">{cert.eventId ? 'Unknown event' : '—'}</span>;
                }
                return <span className="text-sm">{eventTitle}</span>;
            },
        },
        { key: 'issuedAt', header: 'Issued Date', accessor: (cert) => formatDate(cert.issuedAt), cellClassName: 'text-muted-foreground' },
        {
            key: 'actions',
            header: '',
            export: false,
            className: 'w-12',
            cell: (cert) => (<DropdownMenu open={openMenuId === cert.id} onOpenChange={(open) => {
              // A running export owns this menu: closing it now would unmount
              // the download control and cancel the export without a word.
              if (!open && isDownloading) return;
              setOpenMenuId(open ? cert.id : null);
            }}>
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
                {cert.certificateType === 'participation' ? (
                  // ⚠️ THE ENCRYPTED-PDF DOWNLOAD IS OFFERED TO ADMINS ONLY. It
                  // goes through the member endpoint, which 403s a moderator or
                  // a mentor, so the entry is HIDDEN rather than shown disabled:
                  // a dead menu item in a table of dozens of rows reads as a
                  // broken panel, and the page says in plain text that the
                  // download is admin-only.
                  canDownloadMemberCertificate ? (
                    <DownloadCertificateButton
                      certificate={cert}
                      variant="ghost"
                      size="sm"
                      label="Download"
                      className="w-full justify-start gap-2 rounded-sm px-2 py-1.5 text-sm font-normal"
                      onBusyChange={handleDownloadBusyChange}
                    />
                  ) : null
                ) : (
                  // The print view is not the member endpoint — it opens the
                  // public certificate page — so it stays for every
                  // admin-panel role.
                  <DropdownMenuItem onClick={() => openCertificate(cert.certificateId, true)}>
                    <Download className="mr-2 size-4"/>
                    Download
                  </DropdownMenuItem>
                )}
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

      {/* ===== Event rankings → certificates ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4"/>
            Event Rankings → Certificates
          </CardTitle>
          <CardDescription>
            Record an event&apos;s placings and generate the certificates behind them. Re-submitting
            updates the existing certificates instead of issuing duplicates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Event</Label>
              <EventCombobox
                events={events}
                value={rankingsEventId}
                onChange={(nextId) => {
                  setRankingsEventId(nextId);
                  setRankings([]);
                  setRankingsError('');
                  setRankingsMessage(null);
                }}
                placeholder="Select the event"
                allowNone={false}
                noneLabel="Select an event…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Certificate Template</Label>
              <CertificateTemplatePicker
                value={rankingsTemplateKey}
                onChange={setRankingsTemplateKey}
                templates={templateOptions}
                compact
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Committee</Label>
              <Select value={rankingsCommitteeKey || '__none__'} onValueChange={(v) => setRankingsCommitteeKey(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select committee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {committeeOptions.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SignatorySelector
            value={rankingsSignatories}
            onChange={setRankingsSignatories}
          />

          {eventEndsInFuture && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600"/>
              <p className="text-sm text-amber-800">
                This event has not ended yet. Generating certificates now will issue them before the
                event is over.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleLoadRankings} disabled={!rankingsEventId || isLoadingRankings} className="gap-2">
              {isLoadingRankings ? <Loader2 className="size-4 animate-spin"/> : <FileSpreadsheet className="size-4"/>}
              Load Existing Rankings
            </Button>
            <Button variant="outline" onClick={addRankingRow} className="gap-2">
              <Plus className="size-4"/>
              Add Rank
            </Button>
            <Button onClick={handleGenerateRankings} disabled={isSubmittingRankings || rankings.length === 0} className="gap-2">
              {isSubmittingRankings ? <Loader2 className="size-4 animate-spin"/> : <Trophy className="size-4"/>}
              Generate Certificates
            </Button>
          </div>

          {rankings.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No ranking rows yet. Load the event&apos;s existing rankings or add the placings manually.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rankings.map((row, index) => (
                <div key={index} className="grid grid-cols-1 items-center gap-2 rounded-lg border p-3 sm:grid-cols-[80px_1fr_1fr_180px_40px]">
                  <Input
                    type="number"
                    min="1"
                    aria-label={`Rank for row ${index + 1}`}
                    value={row.rank}
                    onChange={(event) => updateRankingRow(index, { rank: event.target.value })}
                    placeholder="Rank"
                  />
                  <Input
                    aria-label={`Recipient name for row ${index + 1}`}
                    value={row.recipientName}
                    onChange={(event) => updateRankingRow(index, { recipientName: event.target.value })}
                    placeholder="Recipient name"
                  />
                  <Input
                    aria-label={`Student ID for row ${index + 1}`}
                    value={row.recipientUniId}
                    onChange={(event) => updateRankingRow(index, { recipientUniId: event.target.value })}
                    placeholder="Student ID"
                  />
                  <Select
                    value={row.certificateType}
                    onValueChange={(value) => updateRankingRow(index, { certificateType: value })}
                  >
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="winner">Winner</SelectItem>
                      <SelectItem value="runner-up">Runner-up</SelectItem>
                      <SelectItem value="2nd-runner-up">2nd Runner-up</SelectItem>
                      <SelectItem value="participation">Participation</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove row ${index + 1}`}
                    onClick={() => removeRankingRow(index)}
                  >
                    <X className="size-4"/>
                  </Button>
                </div>
              ))}
            </div>
          )}

          {rankingsError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {rankingsError}
            </p>
          )}

          {rankingsMessage && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {rankingsMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Issued Certificates</h2>
            <p className="text-sm text-muted-foreground">
              Manage all certificates issued by CPCCU
              {!canDownloadMemberCertificate
                ? ' — downloading a member’s participation certificate PDF is restricted to admins.'
                : ''}
            </p>
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
        {/*
          The form is taller than a laptop viewport, so the panel is capped at
          90vh and only the field list scrolls (`min-h-0` lets the flex child
          shrink below its content height). The header and the footer stay put,
          so the title and the Save button are always reachable.
        */}
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4 pr-12">
            <DialogTitle>{editingCert ? 'Edit Certificate' : 'Issue New Certificate'}</DialogTitle>
            <DialogDescription>
              {editingCert ? 'Update certificate details' : 'Fill in the details to issue a new certificate'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
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
              <Label>Event</Label>
              <EventCombobox
                events={events}
                value={formData.eventId}
                onChange={(nextId) => handleFormEventChange(nextId)}
                placeholder="Link an event (optional)"
                allowNone
                noneLabel="No linked event"
              />
              <p className="text-xs text-muted-foreground">Linking an event fills in the contest name and type, and lets the certificate show up under the event.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Event Name</Label>
              <Input value={formData.eventName} onChange={(e) => setFormData((prev) => ({ ...prev, eventName: e.target.value }))} placeholder="e.g. CPCCU Contest 3"/>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Contest Type</Label>
              <Select value={formData.contestType} onValueChange={(v) => setFormData((prev) => ({ ...prev, contestType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="programming-contest">Programming Contest</SelectItem>
                  <SelectItem value="hackathon">Hackathon</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="article-writing">Article Writing Contest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Certificate Template</Label>
              <CertificateTemplatePicker
                value={formData.templateKey}
                onChange={(templateKey) => setFormData((prev) => ({ ...prev, templateKey }))}
                templates={templateOptions}
                compact
              />
            </div>
            <SignatorySelector
              value={formData.signatories}
              onChange={(signatories) => setFormData((prev) => ({ ...prev, signatories }))}
            />
            <div className="flex flex-col gap-2">
              <Label>Committee</Label>
              <Select value={formData.committee || '__none__'} onValueChange={(v) => setFormData((prev) => ({ ...prev, committee: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select committee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {committeeOptions.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Batch</Label>
              <Input value={formData.batch} onChange={(e) => setFormData((prev) => ({ ...prev, batch: e.target.value }))} placeholder="e.g. 2022, 2023"/>
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
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCert ? 'Update' : 'Issue Certificate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (!open) resetBulkDialog();
      }}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4 pr-12">
            <DialogTitle>Bulk Issue Certificates</DialogTitle>
            <DialogDescription>
              Issue multiple certificates by uploading a completed XLSX file.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 px-4 py-4">
              <div className="flex flex-col gap-2">
                <Label>Event</Label>
                <EventCombobox
                  events={events}
                  value={bulkEventId}
                  onChange={setBulkEventId}
                  placeholder="Link an event (optional)"
                  allowNone
                  noneLabel="No linked event"
                />
                <p className="text-xs text-muted-foreground">
                  With an event picked the sheet&apos;s contest columns are ignored and the event&apos;s
                  title and type are used for every row.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Certificate Template</Label>
                <CertificateTemplatePicker
                  value={bulkTemplateKey}
                  onChange={setBulkTemplateKey}
                  templates={templateOptions}
                  compact
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Committee</Label>
                <Select value={bulkCommitteeKey || '__none__'} onValueChange={(v) => setBulkCommitteeKey(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select committee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {committeeOptions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SignatorySelector
                value={bulkSignatories}
                onChange={setBulkSignatories}
              />
            </div>
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
                {bulkSuccessSummary.skipReasons.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-green-800">Skipped rows:</span>
                    {bulkSuccessSummary.skipReasons.map((reason, index) => (
                      <span key={index} className="text-xs text-green-700">• {reason}</span>
                    ))}
                    {bulkSuccessSummary.skipped > bulkSuccessSummary.skipReasons.length && (
                      <span className="text-xs text-green-600">
                        …and {bulkSuccessSummary.skipped - bulkSuccessSummary.skipReasons.length} more.
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => {
                setBulkDialogOpen(false);
                resetBulkDialog();
            }}>Cancel</Button>
            <Button
              onClick={() => {
                  if (bulkValidationErrors.length === 0 && bulkFileRows.length > 0) {
                      handleBulkIssue();
                  }
              }}
              disabled={!bulkFile || bulkFileRows.length === 0 || bulkValidationErrors.length > 0 || !!bulkSuccessSummary || isBulkIssuing}
              className="gap-2"
            >
              {isBulkIssuing ? <Loader2 className="size-4 animate-spin"/> : null}
              {bulkSuccessSummary ? 'Issued' : isBulkIssuing ? 'Issuing…' : 'Issue Certificates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
  }
