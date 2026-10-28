import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Layers,
  MapPin,
  Phone,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
} from 'lucide-react';
import {
  getPrescriptionReview,
  getPrescriptionSource,
  listPrescriptionWorklist,
  rejectPrescription,
  requestClearerPrescription,
  verifyPrescription,
} from '../api/vda';

type StatusTab = {
  id: string;
  label: string;
};

const STATUS_TABS: StatusTab[] = [
  { id: 'NEEDS_ACTION', label: 'Awaiting Approval (All Pending)' },
  { id: 'PENDING_VERIFICATION', label: 'Pending Review' },
  { id: 'UNVERIFIED', label: 'OCR Flagged' },
  { id: 'VERIFIED', label: 'Verified (Active)' },
  { id: 'NEEDS_RESUBMISSION', label: 'Resubmission Requested' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUPERSEDED', label: 'Superseded History' },
  { id: 'ALL', label: 'All Prescriptions' },
];

const EMPTY_MEDICINE = {
  medicationName: '',
  normalizedName: '',
  strength: '',
  dosage: '',
  dosageForm: '',
  route: '',
  frequency: '',
  timing: '',
  duration: '',
  instructions: '',
};

const MEDICINE_FIELDS: Array<{ key: keyof typeof EMPTY_MEDICINE; label: string; placeholder: string; spanFull?: boolean }> = [
  { key: 'medicationName', label: 'Medicine Name (Brand / Label)', placeholder: 'e.g. Telma 40 / Glycomet GP1' },
  { key: 'normalizedName', label: 'Generic / Salt Name', placeholder: 'e.g. Telmisartan / Metformin' },
  { key: 'strength', label: 'Strength', placeholder: 'e.g. 40 mg / 500 mg' },
  { key: 'dosage', label: 'Dose Amount', placeholder: 'e.g. 1 tablet / 5 ml' },
  { key: 'frequency', label: 'Frequency', placeholder: 'e.g. Once daily (OD) / Twice daily (BD)' },
  { key: 'timing', label: 'Meal Timing', placeholder: 'e.g. After breakfast / Before dinner' },
  { key: 'dosageForm', label: 'Dosage Form', placeholder: 'e.g. Tablet / Capsule / Syrup' },
  { key: 'route', label: 'Route', placeholder: 'e.g. Oral / Topical' },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. 30 days / Continue' },
  { key: 'instructions', label: 'Special Instructions for Patient', placeholder: 'e.g. Monitor blood pressure weekly', spanFull: true },
];

function formatStatusLabel(status: string, activePlan?: boolean): string {
  if (status === 'VERIFIED' && activePlan) return 'ACTIVE VERIFIED PLAN';
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'PENDING MEDICAL REVIEW';
    case 'UNVERIFIED':
      return 'LOW OCR CONFIDENCE';
    case 'VERIFIED':
      return 'VERIFIED';
    case 'NEEDS_RESUBMISSION':
      return 'CLEARER PHOTO REQUESTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'SUPERSEDED':
      return 'SUPERSEDED BY NEWER PLAN';
    default:
      return String(status || '').replaceAll('_', ' ');
  }
}

function statusBadgeClass(status: string, activePlan?: boolean): string {
  if (status === 'VERIFIED' && activePlan) return 'rx-badge rx-badge-active';
  switch (status) {
    case 'PENDING_VERIFICATION':
      return 'rx-badge rx-badge-pending';
    case 'UNVERIFIED':
      return 'rx-badge rx-badge-warning';
    case 'VERIFIED':
      return 'rx-badge rx-badge-verified';
    case 'NEEDS_RESUBMISSION':
      return 'rx-badge rx-badge-resubmit';
    case 'REJECTED':
      return 'rx-badge rx-badge-rejected';
    case 'SUPERSEDED':
      return 'rx-badge rx-badge-superseded';
    default:
      return 'rx-badge';
  }
}

function formatPrescriptionCode(row: any): string {
  if (row?.prescriptionCode) return row.prescriptionCode;
  return `RX-${String(row?.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || '000000'}`;
}

function extractPatientSummary(row: any) {
  if (row?.patient && row.patient.fullName) {
    return row.patient;
  }
  const ref = String(row?.patientRef || '');
  const shortId = ref.replace(/^(mobile-user:|synthetic:)/, '').slice(0, 8);
  return {
    patientRef: ref,
    patientType: ref.startsWith('synthetic:') ? 'SYNTHETIC_PATIENT' : 'MOBILE_USER',
    patientCode: `PT-${shortId.toUpperCase() || 'USER'}`,
    fullName: ref.startsWith('synthetic:') ? `Synthetic Patient (${shortId})` : `Registered Patient (${shortId})`,
    age: null,
    gender: null,
    phone: null,
    district: null,
    state: null,
    preferredLanguage: null,
    abhaNumber: null,
  };
}

function normalizeDetailMedications(detail: any): any[] {
  const verified = Array.isArray(detail?.verifiedMedications) && detail.verifiedMedications.length > 0
    ? detail.verifiedMedications
    : null;
  const extracted = Array.isArray(detail?.extractedMedications) && detail.extractedMedications.length > 0
    ? detail.extractedMedications
    : Array.isArray(detail?.medications)
      ? detail.medications
      : [];
  const rawList = verified || extracted;
  return rawList.map((m: any) => ({
    ...EMPTY_MEDICINE,
    ...m,
    medicationName: String(m?.medicationName || m?.rawName || m?.name || m?.normalizedName || '').trim(),
    normalizedName: String(m?.normalizedName || '').trim(),
    strength: String(m?.strength || '').trim(),
    dosage: String(m?.dosage || '').trim(),
    dosageForm: String(m?.dosageForm || '').trim(),
    route: String(m?.route || '').trim(),
    frequency: String(m?.frequency || '').trim(),
    timing: String(m?.timing || '').trim(),
    duration: String(m?.duration || '').trim(),
    instructions: String(m?.instructions || '').trim(),
  }));
}

function normalizeDetailInvestigations(detail: any): any[] {
  const verified = Array.isArray(detail?.verifiedInvestigations) && detail.verifiedInvestigations.length > 0
    ? detail.verifiedInvestigations
    : null;
  const extracted = Array.isArray(detail?.extractedInvestigations) && detail.extractedInvestigations.length > 0
    ? detail.extractedInvestigations
    : Array.isArray(detail?.investigations)
      ? detail.investigations
      : [];
  const rawList = verified || extracted;
  return rawList.map((inv: any) => {
    const name = String(inv?.rawName || inv?.name || inv?.normalizedName || '').trim();
    return {
      ...inv,
      rawName: name,
      normalizedName: String(inv?.normalizedName || name).trim(),
      reason: String(inv?.reason || '').trim(),
      instructions: String(inv?.instructions || '').trim(),
    };
  });
}

export default function Prescriptions() {
  const [statusFilter, setStatusFilter] = useState<string>('NEEDS_ACTION');
  const [viewMode, setViewMode] = useState<'GROUPED_BY_PATIENT' | 'CHRONOLOGICAL'>('GROUPED_BY_PATIENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRows, setAllRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [patientReason, setPatientReason] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = async () => {
    try {
      // Always fetch all prescriptions so existing uploads across any status are visible and counted
      const list = await listPrescriptionWorklist(undefined);
      setAllRows(Array.isArray(list) ? list : []);
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to load prescription queue.' });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );

  const openPrescription = async (id: string) => {
    try {
      setBusy(true);
      setNotice(null);
      const detail = await getPrescriptionReview(undefined, id);
      let nextSourceUrl = '';
      try {
        const blob = await getPrescriptionSource(undefined, id);
        nextSourceUrl = URL.createObjectURL(blob);
      } catch {
        nextSourceUrl = '';
      }
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(nextSourceUrl);
      setSelected(detail);
      setMedications(normalizeDetailMedications(detail));
      setInvestigations(normalizeDetailInvestigations(detail));
      setNote(detail.verificationNote || '');
      setPatientReason(detail.patientReviewReason || '');
    } catch (error: any) {
      setNotice({ type: 'error', text: error.message || 'Failed to load prescription details.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (kind: 'verify' | 'reject' | 'clearer') => {
    if (!selected) return;
    const patient = extractPatientSummary(selected);
    const rxCode = formatPrescriptionCode(selected);

    const cleanedMedications = medications
      .map((m) => ({
        medicationName: String(m.medicationName || m.normalizedName || m.rawName || '').trim(),
        normalizedName: String(m.normalizedName || '').trim() || null,
        strength: String(m.strength || '').trim() || null,
        dosage: String(m.dosage || '').trim() || null,
        dosageForm: String(m.dosageForm || '').trim() || null,
        route: String(m.route || '').trim() || null,
        frequency: String(m.frequency || '').trim() || null,
        timing: String(m.timing || '').trim() || null,
        duration: String(m.duration || '').trim() || null,
        instructions: String(m.instructions || '').trim() || null,
      }))
      .filter((m) => m.medicationName.length > 0);

    const cleanedInvestigations = investigations
      .map((inv) => {
        const rawName = String(inv.rawName || inv.normalizedName || inv.name || '').trim();
        return {
          rawName,
          normalizedName: String(inv.normalizedName || rawName).trim() || null,
          reason: String(inv.reason || '').trim() || null,
          instructions: String(inv.instructions || '').trim() || null,
        };
      })
      .filter((inv) => inv.rawName.length > 0);

    if (kind === 'verify' && cleanedMedications.length === 0) {
      setNotice({ type: 'error', text: 'Please enter at least one valid Medicine Name before approving.' });
      return;
    }

    const confirmation =
      kind === 'verify'
        ? `Approve ${rxCode} for ${patient.fullName}? This will become the patient's Active Verified Medication Plan (superseding any prior active plan).`
        : kind === 'reject'
          ? `Reject ${rxCode} for ${patient.fullName}?`
          : `Request a clearer prescription photo from ${patient.fullName} for ${rxCode}?`;
    if (!window.confirm(confirmation)) return;

    try {
      setBusy(true);
      if (kind === 'verify') {
        await verifyPrescription(undefined, selected.id, {
          medications: cleanedMedications,
          investigations: cleanedInvestigations,
          note: note.trim() || undefined,
        });
      } else if (kind === 'reject') {
        await rejectPrescription(undefined, selected.id, patientReason, note);
      } else {
        await requestClearerPrescription(undefined, selected.id, patientReason, note);
      }
      const actionText =
        kind === 'verify'
          ? `Prescription ${rxCode} for ${patient.fullName} approved and activated.`
          : kind === 'clearer'
            ? `Requested a clearer photo from ${patient.fullName} for ${rxCode}.`
            : `Prescription ${rxCode} for ${patient.fullName} rejected.`;
      setNotice({ type: 'success', text: actionText });
      await refresh();
      await openPrescription(selected.id);
    } catch (error: any) {
      setNotice({
        type: 'error',
        text:
          error.status === 409
            ? 'This prescription was already decided by another reviewer. Refreshing queue.'
            : error.message || 'Could not record decision.',
      });
    } finally {
      setBusy(false);
    }
  };

  // Compute counts per tab from allRows
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      NEEDS_ACTION: 0,
      PENDING_VERIFICATION: 0,
      UNVERIFIED: 0,
      VERIFIED: 0,
      NEEDS_RESUBMISSION: 0,
      REJECTED: 0,
      SUPERSEDED: 0,
      ALL: allRows.length,
    };
    for (const row of allRows) {
      const st = String(row.verificationStatus || '');
      if (st in counts) counts[st] += 1;
      if (st === 'PENDING_VERIFICATION' || st === 'UNVERIFIED') {
        counts.NEEDS_ACTION += 1;
      }
    }
    return counts;
  }, [allRows]);

  // Compute client-side patient stats so even legacy backends without patientStats work seamlessly
  const enrichedRows = useMemo(() => {
    const statsMap = new Map<
      string,
      { totalSubmissions: number; pendingCount: number; verifiedCount: number; activePrescriptionId: string | null }
    >();
    for (const row of allRows) {
      const ref = row.patientRef || 'unknown';
      const cur = statsMap.get(ref) || {
        totalSubmissions: 0,
        pendingCount: 0,
        verifiedCount: 0,
        activePrescriptionId: null,
      };
      cur.totalSubmissions += 1;
      if (row.verificationStatus === 'PENDING_VERIFICATION' || row.verificationStatus === 'UNVERIFIED') {
        cur.pendingCount += 1;
      }
      if (row.verificationStatus === 'VERIFIED') {
        cur.verifiedCount += 1;
      }
      if (row.activePlan && row.verificationStatus === 'VERIFIED') {
        cur.activePrescriptionId = row.id;
      }
      statsMap.set(ref, cur);
    }
    return allRows.map((row) => ({
      ...row,
      patientStats: row.patientStats || statsMap.get(row.patientRef || 'unknown'),
    }));
  }, [allRows]);

  const statusFilteredRows = useMemo(() => {
    if (statusFilter === 'ALL') return enrichedRows;
    if (statusFilter === 'NEEDS_ACTION') {
      return enrichedRows.filter(
        (row) => row.verificationStatus === 'PENDING_VERIFICATION' || row.verificationStatus === 'UNVERIFIED',
      );
    }
    return enrichedRows.filter((row) => row.verificationStatus === statusFilter);
  }, [enrichedRows, statusFilter]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return statusFilteredRows;
    return statusFilteredRows.filter((row) => {
      const p = extractPatientSummary(row);
      const rxCode = formatPrescriptionCode(row).toLowerCase();
      const meds = Array.isArray(row.medicationPreview) ? row.medicationPreview.join(' ').toLowerCase() : '';
      return (
        p.fullName?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.patientCode?.toLowerCase().includes(q) ||
        p.district?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.abhaNumber?.toLowerCase().includes(q) ||
        row.prescriberName?.toLowerCase().includes(q) ||
        row.patientRef?.toLowerCase().includes(q) ||
        rxCode.includes(q) ||
        meds.includes(q)
      );
    });
  }, [statusFilteredRows, searchQuery]);

  const patientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        patientRef: string;
        patient: ReturnType<typeof extractPatientSummary>;
        patientStats: { totalSubmissions: number; pendingCount: number; verifiedCount: number; activePrescriptionId: string | null };
        items: any[];
      }
    >();
    for (const row of filteredRows) {
      const ref = row.patientRef || 'unknown';
      const existing = map.get(ref);
      if (existing) {
        existing.items.push(row);
      } else {
        map.set(ref, {
          patientRef: ref,
          patient: extractPatientSummary(row),
          patientStats: row.patientStats || {
            totalSubmissions: 1,
            pendingCount:
              row.verificationStatus === 'PENDING_VERIFICATION' || row.verificationStatus === 'UNVERIFIED' ? 1 : 0,
            verifiedCount: row.verificationStatus === 'VERIFIED' ? 1 : 0,
            activePrescriptionId: row.activePlan ? row.id : null,
          },
          items: [row],
        });
      }
    }
    return Array.from(map.values());
  }, [filteredRows]);

  const canDecide =
    selected && !['VERIFIED', 'REJECTED', 'NEEDS_RESUBMISSION', 'SUPERSEDED'].includes(selected.verificationStatus);
  const sourceKind = useMemo(() => selected?.sourceMimeType || '', [selected]);
  const selectedPatient = useMemo(() => (selected ? extractPatientSummary(selected) : null), [selected]);

  // Combine backend patientHistory with client-side fallback from allRows so history always renders even for older records
  const selectedHistory: any[] = useMemo(() => {
    if (!selected) return [];
    if (Array.isArray(selected.patientHistory) && selected.patientHistory.length > 0) {
      return selected.patientHistory;
    }
    return enrichedRows.filter((r) => r.patientRef === selected.patientRef);
  }, [selected, enrichedRows]);

  const existingActivePlan = useMemo(
    () => selectedHistory.find((item) => item.activePlan && item.verificationStatus === 'VERIFIED' && item.id !== selected?.id),
    [selectedHistory, selected?.id],
  );

  return (
    <div className="rx-page">
      <header className="rx-page-header">
        <div>
          <p className="eyebrow">CLINICAL GOVERNANCE & MEDICATION SAFETY</p>
          <h1>Patient Prescription Verification</h1>
          <p>
            Review patient demographics, compare multi-prescription history, and verify AI-extracted regimens before
            activating patient reminders.
          </p>
        </div>
        <div className="rx-header-actions">
          <div className="rx-view-toggle" role="group" aria-label="Queue grouping">
            <button
              type="button"
              className={viewMode === 'GROUPED_BY_PATIENT' ? 'active' : 'secondary'}
              onClick={() => setViewMode('GROUPED_BY_PATIENT')}
            >
              <Layers size={15} />
              <span>Grouped by Patient</span>
            </button>
            <button
              type="button"
              className={viewMode === 'CHRONOLOGICAL' ? 'active' : 'secondary'}
              onClick={() => setViewMode('CHRONOLOGICAL')}
            >
              <Clock size={15} />
              <span>All Submissions</span>
            </button>
          </div>
          <button type="button" className="secondary rx-refresh-btn" onClick={() => void refresh()}>
            <RefreshCw size={15} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </header>

      <section className="rx-toolbar-panel">
        <div className="rx-status-tabs">
          {STATUS_TABS.map((tab) => {
            const count = tabCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                className={statusFilter === tab.id ? 'rx-tab active' : 'rx-tab'}
                onClick={() => {
                  setStatusFilter(tab.id);
                }}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="rx-search-row">
          <div className="rx-search-input-wrap">
            <Search size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Patient Name, Phone (+91...), District, ABHA ID, Doctor, Medicine, or RX Code..."
            />
          </div>
          <div className="rx-queue-summary">
            <span>
              Showing <strong>{filteredRows.length}</strong> of <strong>{allRows.length}</strong> prescription
              {allRows.length === 1 ? '' : 's'} across <strong>{patientGroups.length}</strong> patient
              {patientGroups.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {notice && (
          <div className={`clinical-alert ${notice.type === 'error' ? 'error' : 'success'}`} role="status">
            {notice.text}
          </div>
        )}
      </section>

      <div className="rx-workspace-grid">
        {/* LEFT COLUMN: PATIENT & PRESCRIPTION WORKLIST */}
        <aside className="rx-queue-column">
          <div className="rx-column-header">
            <h2>{viewMode === 'GROUPED_BY_PATIENT' ? 'Patient Prescription Queue' : 'Chronological Submissions'}</h2>
            <span>{filteredRows.length}</span>
          </div>

          {!filteredRows.length ? (
            <div className="rx-empty-queue">
              <FileText size={32} />
              <strong>No prescriptions in this filter</strong>
              <p>
                {allRows.length > 0
                  ? `There are ${allRows.length} total uploaded prescription(s) in the system. Click "All Prescriptions (${allRows.length})" above to view them.`
                  : 'No prescriptions have been uploaded yet.'}
              </p>
              {allRows.length > 0 && statusFilter !== 'ALL' && (
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={() => setStatusFilter('ALL')}
                >
                  Show All Uploaded Prescriptions ({allRows.length})
                </button>
              )}
            </div>
          ) : viewMode === 'GROUPED_BY_PATIENT' ? (
            <div className="rx-patient-group-list">
              {patientGroups.map((group) => {
                const { patient, patientStats, items } = group;
                const hasMultiple = (patientStats?.totalSubmissions || items.length) > 1;
                const isGroupSelected = items.some((item) => item.id === selected?.id);
                return (
                  <div
                    key={group.patientRef}
                    className={`rx-patient-group-card ${isGroupSelected ? 'group-selected' : ''}`}
                  >
                    <div className="rx-patient-group-header">
                      <div className="rx-patient-avatar">
                        <User size={18} />
                      </div>
                      <div className="rx-patient-header-info">
                        <div className="rx-patient-title-row">
                          <strong>{patient.fullName}</strong>
                          <span className="rx-patient-code">{patient.patientCode}</span>
                        </div>
                        <div className="rx-patient-meta-row">
                          {patient.age && <span>{patient.age} yrs</span>}
                          {patient.gender && <span>· {patient.gender}</span>}
                          {patient.phone && <span>· 📞 {patient.phone}</span>}
                          {(patient.district || patient.state) && (
                            <span>
                              · {[patient.district, patient.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {hasMultiple && (
                      <div className="rx-multi-submission-banner">
                        <Layers size={13} />
                        <span>
                          <strong>{patientStats.totalSubmissions} Prescriptions on File</strong>
                          {patientStats.pendingCount > 0 && ` · ${patientStats.pendingCount} Awaiting Review`}
                          {patientStats.activePrescriptionId && ' · 1 Active Verified Plan'}
                        </span>
                      </div>
                    )}

                    <div className="rx-group-submissions">
                      {items.map((item) => {
                        const rxCode = formatPrescriptionCode(item);
                        const isSelected = selected?.id === item.id;
                        const medsPreview: string[] = item.medicationPreview || [];
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`rx-submission-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => void openPrescription(item.id)}
                          >
                            <div className="rx-submission-top">
                              <span className="rx-code-title">
                                {rxCode} <small>· Plan Rev #{item.planRevision || 1}</small>
                              </span>
                              <span className={statusBadgeClass(item.verificationStatus, item.activePlan)}>
                                {formatStatusLabel(item.verificationStatus, item.activePlan)}
                              </span>
                            </div>

                            <div className="rx-submission-middle">
                              <span>
                                <Stethoscope size={12} />{' '}
                                {item.prescriberName ? `Dr. ${item.prescriberName.replace(/^Dr\.?\s*/i, '')}` : 'Prescriber Unspecified'}
                              </span>
                              <span>
                                <Pill size={12} /> {item.medicationCount ?? medsPreview.length} Medicine
                                {(item.medicationCount ?? medsPreview.length) === 1 ? '' : 's'}
                              </span>
                            </div>

                            {medsPreview.length > 0 && (
                              <div className="rx-med-preview-pills">
                                {medsPreview.map((med, i) => (
                                  <span key={i} className="rx-med-chip">
                                    {med}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="rx-submission-foot">
                              <small>Submitted {new Date(item.createdAt).toLocaleString()}</small>
                              {item.reviewRequired && (
                                <span className="rx-ocr-flag">
                                  <AlertTriangle size={11} /> Check OCR
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rx-flat-list">
              {filteredRows.map((row) => {
                const patient = extractPatientSummary(row);
                const rxCode = formatPrescriptionCode(row);
                const isSelected = selected?.id === row.id;
                const medsPreview: string[] = row.medicationPreview || [];
                const totalForPatient = row.patientStats?.totalSubmissions || 1;
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`rx-submission-item rx-flat-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => void openPrescription(row.id)}
                  >
                    <div className="rx-submission-top">
                      <div>
                        <strong className="rx-flat-patient-name">{patient.fullName}</strong>
                        <span className="rx-patient-code" style={{ marginLeft: 6 }}>
                          {patient.patientCode}
                        </span>
                      </div>
                      <span className={statusBadgeClass(row.verificationStatus, row.activePlan)}>
                        {formatStatusLabel(row.verificationStatus, row.activePlan)}
                      </span>
                    </div>

                    <div className="rx-patient-meta-row" style={{ marginBottom: 6 }}>
                      {patient.age && <span>{patient.age} yrs</span>}
                      {patient.gender && <span>· {patient.gender}</span>}
                      {patient.phone && <span>· 📞 {patient.phone}</span>}
                      {(patient.district || patient.state) && (
                        <span>· {[patient.district, patient.state].filter(Boolean).join(', ')}</span>
                      )}
                    </div>

                    <div className="rx-submission-middle">
                      <span className="rx-code-title">
                        {rxCode} · Rev #{row.planRevision || 1}
                      </span>
                      <span>
                        <Pill size={12} /> {row.medicationCount ?? medsPreview.length} Medicine
                        {(row.medicationCount ?? medsPreview.length) === 1 ? '' : 's'}
                      </span>
                      {totalForPatient > 1 && (
                        <span className="rx-multi-pill">{totalForPatient} Total Rx from Patient</span>
                      )}
                    </div>

                    <div className="rx-submission-foot">
                      <small>Submitted {new Date(row.createdAt).toLocaleString()}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: CLINICAL REVIEW & APPROVAL WORKSPACE */}
        <section className="rx-detail-column">
          {!selected ? (
            <div className="rx-detail-empty">
              <ShieldCheck size={44} />
              <h2>{busy ? 'Loading Patient & Prescription Record…' : 'Select a Patient Prescription to Review'}</h2>
              <p>
                Choose a patient submission from the left queue to inspect their demographics, view all prescriptions
                uploaded by that patient, and approve or reject the medication regimen.
              </p>
            </div>
          ) : (
            <div className="rx-detail-content">
              {/* 1. PATIENT DEMOGRAPHICS & IDENTITY BANNER */}
              {selectedPatient && (
                <div className="rx-patient-banner">
                  <div className="rx-patient-banner-main">
                    <div className="rx-patient-banner-avatar">
                      <User size={24} />
                    </div>
                    <div>
                      <div className="rx-patient-banner-title">
                        <h2>{selectedPatient.fullName}</h2>
                        <span className="rx-patient-code">{selectedPatient.patientCode}</span>
                        <span className="rx-patient-type-badge">
                          {selectedPatient.patientType === 'SYNTHETIC_PATIENT' ? 'Synthetic Demo Patient' : 'Registered Mobile Patient'}
                        </span>
                      </div>
                      <div className="rx-patient-demographics-grid">
                        <span>
                          <User size={14} />{' '}
                          <strong>Age / Sex:</strong>{' '}
                          {selectedPatient.age ? `${selectedPatient.age} yrs` : 'N/A'}
                          {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}
                        </span>
                        <span>
                          <Phone size={14} /> <strong>Phone:</strong> {selectedPatient.phone || 'Not provided'}
                        </span>
                        <span>
                          <MapPin size={14} /> <strong>Location:</strong>{' '}
                          {[selectedPatient.district, selectedPatient.state].filter(Boolean).join(', ') || 'Not specified'}
                        </span>
                        {selectedPatient.abhaNumber && (
                          <span>
                            <ShieldCheck size={14} /> <strong>ABHA ID:</strong> {selectedPatient.abhaNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MULTI-PRESCRIPTION PATIENT HISTORY / TIMELINE SWITCHER */}
              {selectedHistory.length > 0 && (
                <div className="rx-history-switcher">
                  <div className="rx-history-header">
                    <div>
                      <strong>
                        <Layers size={15} /> Patient Prescription History ({selectedHistory.length} Submission
                        {selectedHistory.length === 1 ? '' : 's'} from {selectedPatient?.fullName})
                      </strong>
                      <small>
                        Click any submission below to switch between prescriptions uploaded by this patient. Only one
                        verified plan can be active at a time.
                      </small>
                    </div>
                  </div>

                  <div className="rx-history-cards">
                    {selectedHistory.map((histItem) => {
                      const isCurrent = histItem.id === selected.id;
                      return (
                        <button
                          key={histItem.id}
                          type="button"
                          className={`rx-history-card ${isCurrent ? 'current' : ''} ${histItem.activePlan ? 'is-active-plan' : ''}`}
                          onClick={() => {
                            if (!isCurrent) void openPrescription(histItem.id);
                          }}
                        >
                          <div className="rx-history-card-top">
                            <strong>
                              {histItem.prescriptionCode || formatPrescriptionCode(histItem)} · Rev #{histItem.planRevision || 1}
                            </strong>
                            <span className={statusBadgeClass(histItem.verificationStatus, histItem.activePlan)}>
                              {histItem.activePlan && histItem.verificationStatus === 'VERIFIED'
                                ? 'ACTIVE PLAN'
                                : String(histItem.verificationStatus || '').replaceAll('_', ' ')}
                            </span>
                          </div>
                          <div className="rx-history-card-meta">
                            <span>
                              {histItem.medicationCount ?? 0} med{histItem.medicationCount === 1 ? '' : 's'}
                            </span>
                            <span>· {new Date(histItem.createdAt).toLocaleDateString()}</span>
                          </div>
                          {Array.isArray(histItem.medicationPreview) && histItem.medicationPreview.length > 0 && (
                            <small className="rx-history-meds">{histItem.medicationPreview.join(', ')}</small>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {canDecide && existingActivePlan && (
                    <div className="rx-supersede-warning">
                      <AlertTriangle size={16} />
                      <span>
                        <strong>Multiple Prescriptions Notice:</strong> {selectedPatient?.fullName} currently has an
                        Active Verified Plan (
                        <strong>
                          {existingActivePlan.prescriptionCode || formatPrescriptionCode(existingActivePlan)} · Rev #
                          {existingActivePlan.planRevision}
                        </strong>
                        ). Approving this prescription will automatically mark the previous plan as{' '}
                        <code>SUPERSEDED</code> and activate this new regimen.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CURRENT PRESCRIPTION METADATA BAR */}
              <div className="rx-current-meta-bar">
                <div>
                  <span className="rx-eyebrow-code">
                    {formatPrescriptionCode(selected)} · PLAN REVISION #{selected.planRevision || 1}
                  </span>
                  <h3>
                    {selected.prescriberName
                      ? `Prescribed by Dr. ${selected.prescriberName.replace(/^Dr\.?\s*/i, '')}`
                      : 'Clinical Prescription Submission'}
                  </h3>
                  <div className="rx-current-submeta">
                    <span>
                      <Calendar size={13} />{' '}
                      {selected.prescriptionDate
                        ? `Rx Date: ${new Date(selected.prescriptionDate).toLocaleDateString()}`
                        : `Uploaded: ${new Date(selected.createdAt).toLocaleString()}`}
                    </span>
                    {selected.verifiedBy && (
                      <span>
                        <CheckCircle2 size={13} /> Reviewed by <strong>{selected.verifiedBy}</strong> (
                        {selected.verifierRole})
                      </span>
                    )}
                    <span className="rx-tech-file-tag" title="Original uploaded source file">
                      Source: {selected.sourceMimeType || 'document'} ({selected.filename})
                    </span>
                  </div>
                </div>
                <span className={statusBadgeClass(selected.verificationStatus, selected.activePlan)}>
                  {formatStatusLabel(selected.verificationStatus, selected.activePlan)}
                </span>
              </div>

              {/* 4. SOURCE VIEWER + MEDICINE VERIFICATION SPLIT */}
              <div className="rx-review-split">
                {/* SOURCE DOCUMENT PANE */}
                <div className="rx-source-card">
                  <div className="rx-card-section-header">
                    <strong>Original Prescription Document</strong>
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" className="rx-open-external">
                        <ExternalLink size={13} /> Open Full Size
                      </a>
                    )}
                  </div>
                  <div className="rx-source-viewport">
                    {!sourceUrl ? (
                      <div className="rx-source-missing" style={{ padding: 16 }}>
                        <strong>Source binary preview unavailable</strong>
                        {selected.extractedText ? (
                          <pre
                            style={{
                              marginTop: 10,
                              whiteSpace: 'pre-wrap',
                              textAlign: 'left',
                              fontSize: '0.78rem',
                              background: '#fff',
                              padding: 10,
                              borderRadius: 8,
                              border: '1px solid #d5e4dc',
                            }}
                          >
                            {selected.extractedText}
                          </pre>
                        ) : (
                          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#60766b' }}>
                            Review extracted medication fields on the right.
                          </p>
                        )}
                      </div>
                    ) : sourceKind.startsWith('image/') ? (
                      <img src={sourceUrl} alt="Uploaded prescription document" />
                    ) : (
                      <iframe src={sourceUrl} title="Uploaded prescription PDF" />
                    )}
                  </div>
                </div>

                {/* STRUCTURED CLINICAL VERIFICATION FORM */}
                <div className="rx-verification-form-card">
                  <div className="rx-card-section-header">
                    <div>
                      <strong>Clinician-Verified Medication Regimen ({medications.length})</strong>
                      <small>Verify every medicine name, strength, frequency, and meal timing before approval.</small>
                    </div>
                    {canDecide && (
                      <button
                        type="button"
                        className="secondary rx-add-med-btn"
                        onClick={() => setMedications((items) => [...items, { ...EMPTY_MEDICINE }])}
                      >
                        <Plus size={14} /> Add Medicine
                      </button>
                    )}
                  </div>

                  {medications.length === 0 ? (
                    <div className="rx-no-meds-box">
                      <p>
                        No medicines extracted automatically. Click "Add Medicine" to enter medicines from the image, or
                        request a clearer photo.
                      </p>
                    </div>
                  ) : (
                    <div className="rx-med-editor-list">
                      {medications.map((medicine, index) => {
                        const isLowConfidence = String(medicine.confidence || '').toUpperCase() === 'LOW';
                        return (
                          <div key={index} className={`rx-med-editor-card ${isLowConfidence ? 'low-confidence' : ''}`}>
                            <div className="rx-med-editor-header">
                              <div>
                                <strong>Medicine #{index + 1}</strong>
                                {isLowConfidence && (
                                  <span className="rx-low-conf-pill">
                                    <AlertTriangle size={12} /> Low OCR Confidence — Verify Carefully
                                  </span>
                                )}
                              </div>
                              {canDecide && (
                                <button
                                  type="button"
                                  className="rx-remove-med-btn"
                                  onClick={() => setMedications((items) => items.filter((_, i) => i !== index))}
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              )}
                            </div>

                            <div className="rx-med-fields-grid">
                              {MEDICINE_FIELDS.map((field) => (
                                <label
                                  key={field.key}
                                  className={field.spanFull ? 'rx-field-full' : ''}
                                >
                                  <span>{field.label}</span>
                                  <input
                                    type="text"
                                    disabled={!canDecide}
                                    placeholder={field.placeholder}
                                    value={medicine[field.key] || ''}
                                    onChange={(event) =>
                                      setMedications((items) =>
                                        items.map((item, i) =>
                                          i === index ? { ...item, [field.key]: event.target.value } : item,
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* INVESTIGATIONS / LAB TESTS */}
                  <div className="rx-investigations-box">
                    <div className="rx-card-section-header">
                      <strong>Recommended Lab Investigations ({investigations.length})</strong>
                      {canDecide && (
                        <button
                          type="button"
                          className="secondary rx-add-med-btn"
                          onClick={() =>
                            setInvestigations((items) => [
                              ...items,
                              { rawName: '', normalizedName: '', instructions: '' },
                            ])
                          }
                        >
                          <Plus size={14} /> Add Lab Test
                        </button>
                      )}
                    </div>
                    {investigations.length > 0 && (
                      <div className="rx-inv-list">
                        {investigations.map((inv, idx) => (
                          <div key={idx} className="rx-inv-row">
                            <input
                              type="text"
                              disabled={!canDecide}
                              placeholder="Investigation / Lab Test Name (e.g. HbA1c, CBC, Lipid Profile)"
                              value={inv.rawName || inv.normalizedName || ''}
                              onChange={(e) =>
                                setInvestigations((items) =>
                                  items.map((item, i) =>
                                    i === idx
                                      ? { ...item, rawName: e.target.value, normalizedName: e.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            {canDecide && (
                              <button
                                type="button"
                                className="rx-remove-med-btn"
                                onClick={() => setInvestigations((items) => items.filter((_, i) => i !== idx))}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* REVIEW NOTES & ACTION BUTTONS */}
                  <div className="rx-decision-box">
                    <div className="rx-notes-grid">
                      <label>
                        <span>Internal Clinical Audit Note (Confidential — never shown to patient)</span>
                        <textarea
                          disabled={!canDecide}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          rows={2}
                          placeholder="Optional internal clinical note for audit trail..."
                        />
                      </label>
                      <label>
                        <span>Patient-Facing Guidance / Reason (Required for Rejection or Clearer Photo Request)</span>
                        <textarea
                          disabled={!canDecide}
                          value={patientReason}
                          onChange={(event) => setPatientReason(event.target.value)}
                          rows={2}
                          placeholder="e.g. Please upload a clearer photo where the doctor's signature and medicine dosages are fully visible."
                        />
                      </label>
                    </div>

                    {canDecide ? (
                      <div className="rx-action-buttons">
                        <button
                          type="button"
                          className="rx-btn-approve"
                          disabled={busy || !medications.length}
                          onClick={() => void handleDecision('verify')}
                        >
                          <CheckCircle2 size={16} />
                          <span>Approve & Activate Prescription Plan</span>
                        </button>
                        <button
                          type="button"
                          className="rx-btn-resubmit"
                          disabled={busy || !patientReason.trim()}
                          onClick={() => void handleDecision('clearer')}
                        >
                          <AlertTriangle size={16} />
                          <span>Request Clearer Photo</span>
                        </button>
                        <button
                          type="button"
                          className="rx-btn-reject"
                          disabled={busy || !patientReason.trim()}
                          onClick={() => void handleDecision('reject')}
                        >
                          <span>Reject Submission</span>
                        </button>
                      </div>
                    ) : (
                      <div className="rx-decided-banner">
                        <ShieldCheck size={16} />
                        <span>
                          This prescription has already been finalized with status{' '}
                          <strong>{formatStatusLabel(selected.verificationStatus, selected.activePlan)}</strong>
                          {selected.verifiedAt ? ` on ${new Date(selected.verifiedAt).toLocaleString()}` : ''}.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
