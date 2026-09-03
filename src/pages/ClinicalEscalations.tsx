import { useEffect, useRef, useState } from 'react';
import { Clock3, MessageCircleMore, Send, ShieldAlert } from 'lucide-react';
import { endClinicalChat, getClinicalEscalation, listClinicalEscalations, sendClinicianMessage } from '../api/vda';

const time = (value?: string) => value ? new Date(value).toLocaleString() : '—';

export default function ClinicalEscalations() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [status, setStatus] = useState('OPEN');
  const [tier, setTier] = useState('');
  const [ruleId, setRuleId] = useState('');
  const [clinicianMessage, setClinicianMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newPatientMessage, setNewPatientMessage] = useState(false);
  const queueInFlight = useRef(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const load = async (background = false) => {
    if (queueInFlight.current) return;
    queueInFlight.current = true;
    if (!background) { setBusy(true); setError(''); }
    try { setItems(await listClinicalEscalations(undefined, { status, tier, ruleId })); }
    catch { if (!background) setError('The clinical escalation queue could not be loaded.'); }
    finally { queueInFlight.current = false; if (!background) setBusy(false); }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(true), 4_000);
    return () => window.clearInterval(interval);
  }, [status, tier, ruleId]);

  const open = async (id: string) => {
    setError(''); setNotice('');
    try {
      const record = await getClinicalEscalation(undefined, id);
      setSelected(record); setNewPatientMessage(false);
    } catch { setError('The clinical escalation detail could not be loaded.'); }
  };

  useEffect(() => {
    if (!selected?.id || selected.clinicalConversationClosedAt) return;
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
      } catch { /* Keep the current clinician workspace intact during a transient refresh failure. */ }
      finally { inFlight = false; }
    };
    const interval = window.setInterval(() => void refreshDetail(), 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [selected?.id, selected?.clinicalConversationClosedAt]);

  useEffect(() => { transcriptEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [selected?.clinicalConversation?.length]);

  const sendMessage = async () => {
    if (!selected || !clinicianMessage.trim()) return;
    setBusy(true); setError('');
    try {
      await sendClinicianMessage(undefined, selected.id, clinicianMessage.trim());
      setClinicianMessage('');
      setSelected(await getClinicalEscalation(undefined, selected.id));
      setNotice('Message sent to the patient.');
    } catch { setError('The clinician message could not be sent.'); }
    finally { setBusy(false); }
  };

  const endChat = async () => {
    if (!selected || !window.confirm('End this clinical chat? The patient will return to normal VDA chat.')) return;
    setBusy(true); setError('');
    try {
      setSelected(await endClinicalChat(undefined, selected.id));
      setNotice('Clinical chat ended.');
      await load(true);
    } catch { setError('The clinical chat could not be ended.'); }
    finally { setBusy(false); }
  };

  const messages = selected?.clinicalConversation || [];
  const chatState = selected?.clinicalConversationClosedAt ? 'CLOSED' : messages.some((message: any) => message.speaker === 'CLINICIAN') ? 'CONNECTED' : 'WAITING';
  const safetySummary = selected?.patientSafeResponse || selected?.originalPatientResponse || 'Emergency safety response available.';

  return <section className="clinical-escalations-page">
    <header className="clinical-page-header"><div><p className="eyebrow">LIVE CLINICAL SUPPORT</p><h1>Clinical Escalations</h1><p>Respond to the active patient conversation. Safety review and response approval are not part of this workspace.</p></div><span className="live-indicator"><span />Auto-refreshing</span></header>
    <section className="clinical-toolbar"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All records</option><option value="OPEN">Open chats</option><option value="REVIEWED">Reviewed</option><option value="TRUE_POSITIVE">True positive</option><option value="FALSE_POSITIVE">False positive</option></select></label><label>Tier<select value={tier} onChange={(event) => setTier(event.target.value)}><option value="">All tiers</option><option value="T1">T1</option><option value="T2">T2</option></select></label><label>Rule<input value={ruleId} placeholder="EMERGENCY_01" onChange={(event) => setRuleId(event.target.value)} /></label><button className="secondary" onClick={() => void load()} disabled={busy}>Refresh</button></section>
    {(error || notice) && <p className={error ? 'clinical-alert error' : 'clinical-alert success'}>{error || notice}</p>}
    <section className="clinical-workspace">
      <aside className="clinical-queue"><div className="queue-title"><div><b>Active queue</b><small>{status === 'OPEN' ? 'Open patient chats' : 'Filtered records'}</small></div><span>{items.length}</span></div>{busy && !items.length && <p className="empty-state">Loading escalations…</p>}{!busy && !items.length && <p className="empty-state">No matching escalation records.</p>}{items.map((item) => <button key={item.id} className={`clinical-queue-row ${selected?.id === item.id ? 'selected' : ''}`} onClick={() => void open(item.id)}><span className={`tier tier-${item.tier?.toLowerCase()}`}>{item.tier}</span><div><b>{item.clinicalCategory}</b><small>{item.ruleId} · {time(item.createdAt)}</small></div><span className={`queue-state ${item.clinicalConversationClosedAt ? 'closed' : 'open'}`}>{item.clinicalConversationClosedAt ? 'Closed' : 'Open'}</span></button>)}</aside>
      <article className="clinician-chat-workspace">{!selected ? <div className="chat-empty"><MessageCircleMore size={32}/><h2>Select an escalation</h2><p>Choose an active request from the queue to start a clinical conversation.</p></div> : <>
        <header className="chat-workspace-header"><div className="chat-title"><span className={`chat-priority ${selected.tier === 'T1' ? 'urgent' : ''}`}><ShieldAlert size={16}/>{selected.tier} {selected.clinicalCategory}</span><div><h2>{chatState === 'CONNECTED' ? 'Clinical team connected' : chatState === 'CLOSED' ? 'Clinical chat closed' : 'Waiting for clinician'}</h2><p><Clock3 size={14}/>{time(selected.createdAt)} · {selected.ruleId}</p></div></div>{!selected.clinicalConversationClosedAt && <button className="end-chat-button" onClick={() => void endChat()} disabled={busy}>End chat</button>}</header>
        <section className="chat-safety-context"><ShieldAlert size={18}/><div><b>Emergency context</b><p>{safetySummary}</p></div></section>
        <section className="clinician-transcript" aria-label="Clinical conversation">{messages.length === 0 && <div className="chat-system-message">Patient escalation is waiting for a clinician response.</div>}{messages.map((message: any, index: number) => <article key={`${message.createdAt}-${index}`} className={`clinician-bubble ${message.speaker === 'CLINICIAN' ? 'from-clinician' : 'from-patient'}`}><span>{message.speaker === 'CLINICIAN' ? 'Clinical team' : 'Patient'}</span><p>{message.text}</p><small>{time(message.createdAt)}</small></article>)}{newPatientMessage && <div className="chat-system-message new-message">New patient message</div>}<div ref={transcriptEnd}/></section>
        {selected.clinicalConversationClosedAt ? <footer className="chat-closed"><b>Chat closed</b><span>{time(selected.clinicalConversationClosedAt)}</span></footer> : <footer className="clinician-composer"><label htmlFor="clinician-message">Reply to patient</label><div><textarea id="clinician-message" value={clinicianMessage} onChange={(event) => setClinicianMessage(event.target.value)} placeholder="Write a message to the patient…" disabled={busy} /><button onClick={() => void sendMessage()} disabled={busy || !clinicianMessage.trim()}><Send size={17}/>Send</button></div></footer>}
      </>}</article>
    </section>
  </section>;
}
