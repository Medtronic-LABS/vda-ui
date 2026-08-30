import { FormEvent, useEffect, useState } from 'react';
import { approvePrescription, listPrescriptions, listSyntheticPatients, uploadPrescription, listPatientMedications } from '../api/vda';

export default function Prescriptions() {
  const [token, setToken] = useState(sessionStorage.vdaToken || ''),
    [patients, setPatients] = useState<any[]>([]),
    [patientId, setPatientId] = useState(''),
    [rows, setRows] = useState<any[]>([]),
    [activeMeds, setActiveMeds] = useState<any[]>([]),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');

  const loadPatients = () => listSyntheticPatients(token).then(setPatients).catch((e: any) => setError(e.message));
  const load = () => {
    if (!patientId) return;
    listPrescriptions(token, patientId).then(setRows).catch((e: any) => setError(e.message));
    listPatientMedications(token, patientId).then(setActiveMeds).catch((e: any) => setError(e.message));
  };

  useEffect(() => {
    if (token) loadPatients();
  }, []);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!patientId || !file) return;
    try {
      await uploadPrescription(token, patientId, file);
      setMessage('Prescription extracted and queued for review.');
      setError('');
      setFile(null);
      load();
    } catch (x: any) {
      setError(x.message);
    }
  };

  const getDoseComparison = (m: any) => {
    const medName = (m.medicationName || '').toLowerCase().trim();
    const activeConfirmedMeds = activeMeds.filter((am: any) => am.verificationStatus === 'CONFIRMED' && am.status === 'ACTIVE');
    const existing = activeConfirmedMeds.find((am: any) => (am.name || '').toLowerCase().trim() === medName);
    let statusLabel = 'NEW';
    let diffDetails = '';

    if (existing) {
      const currentStrength = (existing.strength || existing.dosage || '').toLowerCase().trim();
      const newStrength = (m.strength || '').toLowerCase().trim();
      const currentFreq = (existing.frequency || '').toLowerCase().trim();
      const newFreq = (m.frequency || '').toLowerCase().trim();

      const isChanged = (newStrength && currentStrength !== newStrength) || (newFreq && currentFreq !== newFreq);
      statusLabel = isChanged ? 'CHANGED' : 'EXISTING';
      if (isChanged) {
        const currentStr = [existing.strength || existing.dosage, existing.frequency].filter(Boolean).join(' / ');
        const newStr = [m.strength, m.frequency].filter(Boolean).join(' / ');
        diffDetails = ` (CURRENT: ${currentStr || 'Unknown'} → NEW: ${newStr || 'Unknown'})`;
      }
    }

    return { statusLabel, diffDetails };
  };

  return (
    <>
      <h1>Prescriptions</h1>
      <section className="panel">
        <b>DEVELOPMENT / SYNTHETIC DATA — NOT REAL PATIENT DATA</b>
        <input placeholder="Admin bearer token" value={token} onChange={e => setToken(e.target.value)} />
        <button onClick={loadPatients}>Load patients</button>
        <select value={patientId} onChange={e => { setPatientId(e.target.value); setRows([]); setActiveMeds([]); }}>
          <option value="">Select synthetic patient</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button disabled={!patientId} onClick={load}>Load prescriptions</button>
        <p style={{ color: error ? 'red' : 'green' }}>{error || message}</p>
      </section>
      
      <section className="panel">
        <h2>Upload for extraction</h2>
        <form onSubmit={upload}>
          <input type="file" accept=".pdf,image/*,.txt,.md" required onChange={e => setFile(e.target.files?.[0] || null)} />
          <button disabled={!patientId || !file}>Upload and extract</button>
        </form>
        <p>Missing fields stay unknown; timing is never inferred.</p>
      </section>

      <section className="panel">
        <h2>Review queue</h2>
        {!rows.length ? (
          <p>No prescriptions for the selected patient.</p>
        ) : (
          rows.map(r => (
            <article key={r.id} style={{ borderBottom: '1px solid #ccc', paddingBottom: '16px', marginBottom: '16px' }}>
              <b>{r.filename}</b>
              <p>Status: {r.extractionStatus} — Checksum: {r.checksum}</p>
              <p>Source: {r.sourceDocumentId}</p>
              <ul>
                {(r.medications || []).map((m: any, i: number) => {
                  const { statusLabel, diffDetails } = getDoseComparison(m);
                  return (
                    <li key={i} style={{ marginBottom: '6px' }}>
                      <span className={`status-badge status-${statusLabel.toLowerCase()}`}>{statusLabel}</span>{' '}
                      <b>{m.medicationName}</b> {m.strength || ''} — {m.frequency || 'Frequency not specified'} — {m.timing || 'Timing not specified'}
                      {diffDetails && <span className="dose-change-diff" style={{ marginLeft: '6px', fontStyle: 'italic', color: '#b25e00', fontWeight: 'bold' }}>{diffDetails}</span>}
                    </li>
                  );
                })}
              </ul>
              {r.extractionStatus === 'REVIEW_REQUIRED' && (
                <button onClick={() => approvePrescription(token, patientId, r.id).then(() => { setMessage('Prescription approved.'); load(); }).catch((e: any) => setError(e.message))}>
                  Approve extracted prescription
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}