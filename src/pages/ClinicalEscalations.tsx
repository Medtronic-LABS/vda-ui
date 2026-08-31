import { useEffect, useState } from 'react';
import { endClinicalChat, getClinicalEscalation, listClinicalEscalations, reviewClinicalEscalation, reviewClinicalResponse, sendClinicianMessage } from '../api/vda';

const time = (value?: string) => value ? new Date(value).toLocaleString() : '—';
type SafetyOutcome = 'TRUE_POSITIVE' | 'FALSE_POSITIVE';
type ResponseDecision = 'APPROVED' | 'CORRECTED' | 'ANNOTATED';

export default function ClinicalEscalations() {
  const [items, setItems] = useState<any[]>([]); const [selected, setSelected] = useState<any>(null);
  const [status, setStatus] = useState('OPEN'); const [tier, setTier] = useState(''); const [ruleId, setRuleId] = useState('');
  const [safetyNote, setSafetyNote] = useState(''); const [responseNote, setResponseNote] = useState(''); const [correction, setCorrection] = useState('');
  const [clinicianMessage, setClinicianMessage] = useState('');
  const [mode, setMode] = useState<ResponseDecision | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [newPatientMessage, setNewPatientMessage] = useState(false);
  const load = async (background = false) => { if (!background) setBusy(true); if (!background) setError(''); try { setItems(await listClinicalEscalations(undefined, { status, tier, ruleId })); } catch { if (!background) setError('The clinical escalation queue could not be loaded.'); } finally { if (!background) setBusy(false); } };
  useEffect(() => { void load(); const interval = window.setInterval(() => { void load(true); }, 4_000); return () => window.clearInterval(interval); }, [status, tier, ruleId]);
  const open = async (id: string) => { setError(''); setNotice(''); try { const record = await getClinicalEscalation(undefined, id); setSelected(record); setNewPatientMessage(false); setSafetyNote(''); setResponseNote(''); setCorrection(record.originalPatientResponse || record.patientSafeResponse || ''); setMode(null); } catch { setError('The clinical escalation detail could not be loaded.'); } };
  useEffect(() => {
    if (!selected?.id || selected.status !== 'OPEN') return;
    let active = true; let inFlight = false;
    const refreshDetail = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const record = await getClinicalEscalation(undefined, selected.id);
        if (!active) return;
        setSelected((current: any) => {
          if (!current || current.id !== record.id) return current;
          const known = current.clinicalConversation || [];
          const incoming = record.clinicalConversation || [];
          if (incoming.length > known.length && incoming.slice(known.length).some((message: any) => message.speaker === 'PATIENT')) setNewPatientMessage(true);
          return record;
        });
      } catch { /* background refresh must not replace visible operational state */ } finally { inFlight = false; }
    };
    const interval = window.setInterval(() => { void refreshDetail(); }, 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [selected?.id, selected?.status]);
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
  const sendMessage = async () => {
    if (!selected || !clinicianMessage.trim()) return;
    setBusy(true); setError('');
    try {
      await sendClinicianMessage(undefined, selected.id, clinicianMessage.trim());
      setClinicianMessage('');
      await open(selected.id);
      setNotice('Clinician message sent to the patient.');
    } catch { setError('The clinician message could not be sent.'); } finally { setBusy(false); }
  };
  const endChat = async () => {
    if (!selected || !window.confirm('End clinical conversation? The patient will no longer be connected to this clinical escalation conversation.')) return;
    setBusy(true); setError('');
    try {
      const record = await endClinicalChat(undefined, selected.id);
      setSelected(record); setNotice('Clinical conversation ended. Normal VDA chat can resume for the patient.'); await load(true);
    } catch { setError('The clinical conversation could not be ended.'); } finally { setBusy(false); }
  };
  const originalResponse = selected?.originalPatientResponse || selected?.patientSafeResponse || '—';
  const response = selected?.correctedPatientResponse || originalResponse;
  return <><h1>Clinical Escalations</h1><section className="panel escalation-notice"><p><b>Operational review queue.</b> Privacy-minimized safety evidence only. Clinician messages are delivered to the matching active patient session; response corrections remain a separate review action and are not delivered automatically.</p></section>
    <section className="panel escalation-filters"><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="OPEN">Open</option><option value="REVIEWED">Reviewed</option><option value="TRUE_POSITIVE">True positive</option><option value="FALSE_POSITIVE">False positive</option></select></label><label>Tier<select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">All</option><option value="T1">T1</option><option value="T2">T2</option></select></label><label>Rule ID<input value={ruleId} placeholder="e.g. EMERGENCY_01" onChange={(e) => setRuleId(e.target.value)} /></label><button className="secondary" onClick={() => void load()} disabled={busy}>Refresh</button></section>
    {(error || notice) && <section className="panel"><p className={error ? 'error' : 'success'}>{error || notice}</p></section>}
    <section className="panel escalation-layout"><div className="escalation-queue">{busy && !items.length && <p>Loading queue...</p>}{!busy && !items.length && <p>No matching escalation records.</p>}{items.map((item) => <button key={item.id} className={`escalation-row ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => void open(item.id)}><span className={`tier tier-${item.tier?.toLowerCase()}`}>{item.tier}</span><b>{item.clinicalCategory}</b><small>{item.ruleId} · {time(item.createdAt)}</small><em>{item.status}</em></button>)}</div>
      <article className="escalation-detail">{!selected ? <p>Select an escalation to view its rule-derived details.</p> : <><h2>Clinical escalation</h2><h3>{selected.tier} · {selected.clinicalCategory}</h3><dl><dt>Status</dt><dd>{selected.status}</dd><dt>Rule</dt><dd>{selected.ruleId} {selected.ruleVersion ? `v${selected.ruleVersion}` : ''}</dd><dt>Language</dt><dd>{selected.language || '—'}</dd><dt>Session</dt><dd className="technical-id">Synthetic session · {selected.sessionId || selected.turnId}</dd><dt>Response decision</dt><dd>{selected.responseReviewDecision || '—'}</dd><dt>Created</dt><dd>{time(selected.createdAt)}</dd></dl>
        <h3>Sanitized input</h3><p className="evidence">{selected.sanitizedInputText || 'Not retained by conversation policy.'}</p><h3>Patient safety response</h3><p className="evidence">{response}</p>{selected.correctedPatientResponse && <><h3>Original response</h3><p className="evidence">{originalResponse}</p><h3>Corrected response</h3><p className="evidence">{selected.correctedPatientResponse}</p></>}
        <h3>Clinical conversation {newPatientMessage && <small className="success">NEW MESSAGE</small>}</h3><div className="clinical-chat-transcript">{selected.clinicalConversation?.length ? selected.clinicalConversation.map((message: any, index: number) => <article key={`${message.createdAt}-${index}`} className={`clinical-chat-turn ${message.speaker === 'CLINICIAN' ? 'clinician' : 'patient'}`}><b>{message.speaker === 'CLINICIAN' ? 'Clinical Team' : 'Patient'}</b><p>{message.text}</p><small>{time(message.createdAt)}</small></article>) : <p>No retained clinical conversation messages.</p>}</div>{selected.clinicalConversationClosedAt ? <p className="success">Clinical conversation closed · {time(selected.clinicalConversationClosedAt)}</p> : <><label>Clinician message<textarea value={clinicianMessage} onChange={(e) => setClinicianMessage(e.target.value)} placeholder="Write message..." disabled={busy || selected.status !== 'OPEN'} /></label><div className="escalation-actions"><button onClick={() => void sendMessage()} disabled={busy || selected.status !== 'OPEN' || !clinicianMessage.trim()}>Send to patient</button><button className="secondary" onClick={() => void endChat()} disabled={busy || selected.status !== 'OPEN'}>End Clinical Chat</button></div></>}
        <h3>Safety outcome</h3><textarea value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} placeholder="Optional classification note" disabled={busy} /><div className="escalation-actions"><button onClick={() => void classifySafety('TRUE_POSITIVE')} disabled={busy}>True positive</button><button className="secondary" onClick={() => void classifySafety('FALSE_POSITIVE')} disabled={busy}>False positive</button></div>
        <h3>Response review</h3><div className="response-review-actions"><button className={mode === 'APPROVED' ? 'active' : ''} onClick={() => setMode('APPROVED')} disabled={busy}>Approve as drafted</button><button className={mode === 'CORRECTED' ? 'active' : ''} onClick={() => setMode('CORRECTED')} disabled={busy}>Correct response</button><button className={mode === 'ANNOTATED' ? 'active' : ''} onClick={() => setMode('ANNOTATED')} disabled={busy}>Annotation only</button></div>
        {mode && <div className="response-review-editor">{mode === 'CORRECTED' && <><label>Corrected response<textarea value={correction} onChange={(e) => setCorrection(e.target.value)} disabled={busy} /></label><small>The original response is preserved. Patient delivery is not configured.</small></>}<label>Reviewer note<textarea value={responseNote} onChange={(e) => setResponseNote(e.target.value)} placeholder="Optional operational annotation" disabled={busy} /></label><button onClick={() => void submitResponseReview()} disabled={busy}>{mode === 'APPROVED' ? 'Approve response' : mode === 'CORRECTED' ? 'Submit correction' : 'Save annotation'}</button></div>}
        <h3>Review history</h3><ul className="review-history"><li><b>CREATED</b> · {time(selected.createdAt)}</li>{selected.reviewHistory?.filter((entry: any) => entry.action !== 'CREATED').map((entry:any, index:number) => <li key={index}><b>{entry.action || entry.outcome}</b> · {time(entry.reviewedAt || entry.at)}{entry.reviewerId ? ` · ${entry.reviewerId}` : ''}{entry.correctedResponse && <><br /><small>Original: {entry.originalResponse || originalResponse}</small><br /><small>Corrected: {entry.correctedResponse}</small></>}{entry.note && <><br /><small>Note: {entry.note}</small></>}</li>)}</ul></>}</article>
    </section></>;
}
