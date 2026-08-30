import { useEffect, useState } from 'react';
import { getClinicalEscalation, listClinicalEscalations, reviewClinicalEscalation, reviewClinicalResponse } from '../api/vda';

const time = (value?: string) => value ? new Date(value).toLocaleString() : '—';
type SafetyOutcome = 'TRUE_POSITIVE' | 'FALSE_POSITIVE';
type ResponseDecision = 'APPROVED' | 'CORRECTED' | 'ANNOTATED';

export default function ClinicalEscalations() {
  const [items, setItems] = useState<any[]>([]); const [selected, setSelected] = useState<any>(null);
  const [status, setStatus] = useState('OPEN'); const [tier, setTier] = useState(''); const [ruleId, setRuleId] = useState('');
  const [safetyNote, setSafetyNote] = useState(''); const [responseNote, setResponseNote] = useState(''); const [correction, setCorrection] = useState('');
  const [mode, setMode] = useState<ResponseDecision | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); setError(''); try { setItems(await listClinicalEscalations(undefined, { status, tier, ruleId })); } catch { setError('The clinical escalation queue could not be loaded.'); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, [status, tier, ruleId]);
  const open = async (id: string) => { setError(''); setNotice(''); try { const record = await getClinicalEscalation(undefined, id); setSelected(record); setSafetyNote(''); setResponseNote(''); setCorrection(record.originalPatientResponse || record.patientSafeResponse || ''); setMode(null); } catch { setError('The clinical escalation detail could not be loaded.'); } };
  const classifySafety = async (outcome: SafetyOutcome) => { if (!selected) return; setBusy(true); setError(''); try { const record = await reviewClinicalEscalation(undefined, selected.id, { outcome, note: safetyNote || undefined }); setSelected(record); await load(); } catch { setError('The safety outcome could not be saved.'); } finally { setBusy(false); } };
  const submitResponseReview = async () => {
    if (!selected || !mode) return;
    if (mode === 'APPROVED' && !window.confirm('Approve the existing patient safety response without changing it?')) return;
    if (mode === 'CORRECTED' && !correction.trim()) { setError('A corrected response is required.'); return; }
    setBusy(true); setError('');
    try {
      const record = await reviewClinicalResponse(undefined, selected.id, { decision: mode, note: responseNote || undefined, correctedResponse: mode === 'CORRECTED' ? correction : undefined });
      setSelected(record);
      setNotice(mode === 'CORRECTED' ? 'Correction saved. Patient delivery is not configured.' : mode === 'APPROVED' ? 'Existing response approved.' : 'Annotation saved. Patient response was not changed.');
      setMode(null); await load();
    } catch { setError('The response review could not be saved.'); } finally { setBusy(false); }
  };
  const originalResponse = selected?.originalPatientResponse || selected?.patientSafeResponse || '—';
  const response = selected?.correctedPatientResponse || originalResponse;
  return <><h1>Clinical Escalations</h1><section className="panel escalation-notice"><p><b>Operational review queue.</b> Privacy-minimized safety evidence only. This review does not page a clinician or deliver a corrected response to a patient.</p></section>
    <section className="panel escalation-filters"><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="OPEN">Open</option><option value="REVIEWED">Reviewed</option><option value="TRUE_POSITIVE">True positive</option><option value="FALSE_POSITIVE">False positive</option></select></label><label>Tier<select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">All</option><option value="T1">T1</option><option value="T2">T2</option></select></label><label>Rule ID<input value={ruleId} placeholder="e.g. EMERGENCY_01" onChange={(e) => setRuleId(e.target.value)} /></label><button className="secondary" onClick={() => void load()} disabled={busy}>Refresh</button></section>
    {(error || notice) && <section className="panel"><p className={error ? 'error' : 'success'}>{error || notice}</p></section>}
    <section className="panel escalation-layout"><div className="escalation-queue">{busy && !items.length && <p>Loading queue...</p>}{!busy && !items.length && <p>No matching escalation records.</p>}{items.map((item) => <button key={item.id} className={`escalation-row ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => void open(item.id)}><span className={`tier tier-${item.tier?.toLowerCase()}`}>{item.tier}</span><b>{item.clinicalCategory}</b><small>{item.ruleId} · {time(item.createdAt)}</small><em>{item.status}</em></button>)}</div>
      <article className="escalation-detail">{!selected ? <p>Select an escalation to view its rule-derived details.</p> : <><h2>Clinical escalation</h2><h3>{selected.tier} · {selected.clinicalCategory}</h3><dl><dt>Status</dt><dd>{selected.status}</dd><dt>Rule</dt><dd>{selected.ruleId} {selected.ruleVersion ? `v${selected.ruleVersion}` : ''}</dd><dt>Language</dt><dd>{selected.language || '—'}</dd><dt>Session</dt><dd className="technical-id">Synthetic session · {selected.sessionId || selected.turnId}</dd><dt>Response decision</dt><dd>{selected.responseReviewDecision || '—'}</dd><dt>Created</dt><dd>{time(selected.createdAt)}</dd></dl>
        <h3>Sanitized input</h3><p className="evidence">{selected.sanitizedInputText || 'Not retained by conversation policy.'}</p><h3>Patient safety response</h3><p className="evidence">{response}</p>{selected.correctedPatientResponse && <><h3>Original response</h3><p className="evidence">{originalResponse}</p><h3>Corrected response</h3><p className="evidence">{selected.correctedPatientResponse}</p></>}
        <h3>Safety outcome</h3><textarea value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} placeholder="Optional classification note" disabled={busy} /><div className="escalation-actions"><button onClick={() => void classifySafety('TRUE_POSITIVE')} disabled={busy}>True positive</button><button className="secondary" onClick={() => void classifySafety('FALSE_POSITIVE')} disabled={busy}>False positive</button></div>
        <h3>Response review</h3><div className="response-review-actions"><button className={mode === 'APPROVED' ? 'active' : ''} onClick={() => setMode('APPROVED')} disabled={busy}>Approve as drafted</button><button className={mode === 'CORRECTED' ? 'active' : ''} onClick={() => setMode('CORRECTED')} disabled={busy}>Correct response</button><button className={mode === 'ANNOTATED' ? 'active' : ''} onClick={() => setMode('ANNOTATED')} disabled={busy}>Annotation only</button></div>
        {mode && <div className="response-review-editor">{mode === 'CORRECTED' && <><label>Corrected response<textarea value={correction} onChange={(e) => setCorrection(e.target.value)} disabled={busy} /></label><small>The original response is preserved. Patient delivery is not configured.</small></>}<label>Reviewer note<textarea value={responseNote} onChange={(e) => setResponseNote(e.target.value)} placeholder="Optional operational annotation" disabled={busy} /></label><button onClick={() => void submitResponseReview()} disabled={busy}>{mode === 'APPROVED' ? 'Approve response' : mode === 'CORRECTED' ? 'Submit correction' : 'Save annotation'}</button></div>}
        <h3>Review history</h3><ul className="review-history"><li><b>CREATED</b> · {time(selected.createdAt)}</li>{selected.reviewHistory?.filter((entry: any) => entry.action !== 'CREATED').map((entry:any, index:number) => <li key={index}><b>{entry.action || entry.outcome}</b> · {time(entry.reviewedAt || entry.at)}{entry.reviewerId ? ` · ${entry.reviewerId}` : ''}{entry.correctedResponse && <><br /><small>Original: {entry.originalResponse || originalResponse}</small><br /><small>Corrected: {entry.correctedResponse}</small></>}{entry.note && <><br /><small>Note: {entry.note}</small></>}</li>)}</ul></>}</article>
    </section></>;
}
