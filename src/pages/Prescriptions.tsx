import { useEffect, useMemo, useState } from 'react';
import { getPrescriptionReview, getPrescriptionSource, listPrescriptionWorklist, rejectPrescription, requestClearerPrescription, verifyPrescription } from '../api/vda';

const tabs = ['PENDING_VERIFICATION', 'UNVERIFIED', 'NEEDS_RESUBMISSION', 'VERIFIED', 'REJECTED'];
const emptyMedicine = { medicationName: '', normalizedName: '', strength: '', dosage: '', dosageForm: '', route: '', frequency: '', timing: '', duration: '', instructions: '' };

export default function Prescriptions() {
  const [status, setStatus] = useState('PENDING_VERIFICATION');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [medications, setMedications] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [patientReason, setPatientReason] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = async () => { try { setRows(await listPrescriptionWorklist(undefined, status)); setNotice(''); } catch (error: any) { setNotice(error.message); } };
  useEffect(() => { void refresh(); }, [status]);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const open = async (id: string) => {
    try {
      setBusy(true);
      const detail = await getPrescriptionReview(undefined, id);
      const blob = await getPrescriptionSource(undefined, id);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(URL.createObjectURL(blob));
      setSelected(detail);
      setMedications((detail.verifiedMedications || detail.extractedMedications || []).map((m: any) => ({ ...emptyMedicine, ...m })));
      setInvestigations(detail.verifiedInvestigations || detail.extractedInvestigations || []);
      setNote(detail.verificationNote || '');
      setPatientReason(detail.patientReviewReason || '');
      setNotice('');
    } catch (error: any) { setNotice(error.message); } finally { setBusy(false); }
  };

  const decision = async (kind: 'verify' | 'reject' | 'clearer') => {
    if (!selected) return;
    const confirmation = kind === 'verify' ? 'Confirm this worker-reviewed prescription? It will become the active verified medication plan.' : kind === 'reject' ? 'Reject this prescription?' : 'Request a clearer prescription image?';
    if (!window.confirm(confirmation)) return;
    try {
      setBusy(true);
      if (kind === 'verify') await verifyPrescription(undefined, selected.id, { medications, investigations, note });
      else if (kind === 'reject') await rejectPrescription(undefined, selected.id, patientReason, note);
      else await requestClearerPrescription(undefined, selected.id, patientReason, note);
      setSelected(null); setSourceUrl(''); setNotice('Decision recorded.'); await refresh();
    } catch (error: any) { setNotice(error.status === 409 ? 'This prescription was already decided by another reviewer. Refresh the queue.' : error.message); } finally { setBusy(false); }
  };

  const canDecide = selected && !['VERIFIED', 'REJECTED', 'NEEDS_RESUBMISSION', 'SUPERSEDED'].includes(selected.verificationStatus);
  const sourceKind = useMemo(() => selected?.sourceMimeType || '', [selected]);

  return <>
    <header><p className="eyebrow">PILOT WORKER WORKSPACE</p><h1>Prescription verification</h1><p>Authenticated ASHA/ANM/CHO review only. AI extraction is never treated as verified medication truth.</p></header>
    <section className="panel"><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{tabs.map(tab => <button key={tab} className={status === tab ? '' : 'secondary'} onClick={() => { setStatus(tab); setSelected(null); }}>{tab.replaceAll('_',' ')}</button>)}<button className="secondary" onClick={refresh}>Refresh</button></div>{notice && <p role="status">{notice}</p>}</section>
    <div style={{display:'grid',gridTemplateColumns:'minmax(260px, 0.75fr) minmax(480px, 1.6fr)',gap:20,alignItems:'start'}}>
      <section className="panel"><h2>Worklist</h2>{!rows.length ? <p>No prescriptions in this queue.</p> : rows.map(row => <button key={row.id} className="secondary" style={{display:'block',width:'100%',textAlign:'left',marginBottom:10}} onClick={() => void open(row.id)}><b>{row.filename}</b><br/><small>{row.patientRef} · {row.verificationStatus}<br/>{new Date(row.createdAt).toLocaleString()}</small></button>)}</section>
      <section className="panel">
        {!selected ? <p>{busy ? 'Loading secure prescription…' : 'Select a prescription to review.'}</p> : <>
          <h2>{selected.filename}</h2><p><b>Status:</b> {selected.verificationStatus} · <b>Revision:</b> {selected.planRevision}</p>
          <div style={{minHeight:320,border:'1px solid #d8e2e8',borderRadius:12,overflow:'hidden',marginBottom:18}}>{sourceUrl && (sourceKind.startsWith('image/') ? <img src={sourceUrl} alt="Prescription source" style={{maxWidth:'100%',display:'block',margin:'auto'}}/> : <iframe src={sourceUrl} title="Prescription source" style={{width:'100%',height:420,border:0}}/>)}</div>
          <h3>Worker-reviewed medicines</h3>
          {medications.map((medicine,index) => <fieldset key={index} style={{marginBottom:12}}><legend>Medicine {index+1}</legend>{Object.keys(emptyMedicine).map(key => <label key={key} style={{display:'block',marginBottom:6}}>{key}<input value={medicine[key] || ''} onChange={event => setMedications(items => items.map((item,i) => i===index ? {...item,[key]:event.target.value} : item))}/></label>)}<button className="secondary" onClick={() => setMedications(items => items.filter((_,i) => i!==index))}>Remove</button></fieldset>)}
          <button className="secondary" onClick={() => setMedications(items => [...items,{...emptyMedicine}])}>Add medicine</button>
          <label style={{display:'block',marginTop:16}}>Internal review note (never shown to the patient)<textarea value={note} onChange={event => setNote(event.target.value)} rows={3}/></label>
          <label style={{display:'block',marginTop:16}}>Patient-facing reason (required for rejection or resubmission)<textarea value={patientReason} onChange={event => setPatientReason(event.target.value)} rows={3}/></label>
          {canDecide && <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button disabled={busy || !medications.length} onClick={() => void decision('verify')}>Verify prescription</button><button className="secondary" disabled={busy || !patientReason.trim()} onClick={() => void decision('clearer')}>Request clearer image</button><button className="secondary" disabled={busy || !patientReason.trim()} onClick={() => void decision('reject')}>Reject</button></div>}
        </>}
      </section>
    </div>
  </>;
}
