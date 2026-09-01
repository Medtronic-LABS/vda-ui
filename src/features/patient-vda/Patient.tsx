import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { ApiError } from "../../api/client";
import { getClinicalReviewState, getSessionPatientContext, listLocalPrototypePatients, sendTurn, startLocalPrototypeSession, synthesizeVoice, uploadSessionPrescription } from "../../api/vda";
import type { Language, Turn } from "../../types/api";
import { VoiceInput } from "./VoiceInput";

type Message = { q?: string; t?: Turn; e?: string; createdAt: number; clinical?: boolean };
type SessionPatient = { name: string; age?: number; gender?: string; language?: Language; dataSource?: 'local-file' | 'synthetic'; conditions?: string[]; medications?: Array<{ name: string; dosage?: string; frequency?: string }>; labs?: Array<{ name: string; value?: string; unit?: string }> };
type PatientChoice = { id: string; name: string; age?: number; gender?: string; language?: Language; state?: string; district?: string };
type ClinicalReviewState = { reviewRequested: boolean; teleconsultationOffered: boolean; teleconsultationConfigured: boolean; messages: Array<{ speaker: 'PATIENT' | 'CLINICIAN'; text: string; createdAt: string }> };

const token = import.meta.env.VITE_DEV_AUTH_TOKEN || "";

const quick: Record<Language, string[]> = {
  hi: [
    "💊 मेरी कौन सी दवाइयाँ चल रही हैं?",
    "📊 मेरी रिपोर्ट्स दिखाएं",
    "🏥 नजदीकी अस्पताल ढूंढें",
    "📜 PM-JAY योजना जानकारी",
  ],
  en: [
    "💊 My medicines",
    "📊 My lab reports",
    "🏥 Find nearby hospital",
    "📜 PM-JAY info",
  ],
};

const quickQuery: Record<string, string> = {
  "💊 मेरी कौन सी दवाइयाँ चल रही हैं?": "मेरी कौन सी दवाइयाँ चल रही हैं?",
  "📊 मेरी रिपोर्ट्स दिखाएं": "मेरी HbA1c रिपोर्ट क्या है?",
  "🏥 नजदीकी अस्पताल ढूंढें": "मेरे घर के पास कौन सा अस्पताल है?",
  "📜 PM-JAY योजना जानकारी": "PM-JAY योजना की जानकारी क्या है?",
  "💊 My medicines": "Which medicines are in my active record?",
  "📊 My lab reports": "What is my HbA1c lab report?",
  "🏥 Find nearby hospital": "Which hospital is near my location?",
  "📜 PM-JAY info": "What is PM-JAY scheme coverage?",
};

export default function Patient() {
  const { sessionId: selectedSessionId } = useParams();
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>("hi"),
    [sid, setSid] = useState(selectedSessionId || ""),
    [state, setState] = useState<"loading" | "ready" | "select" | "error">(selectedSessionId ? "loading" : "select"),
    [list, setList] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [choices, setChoices] = useState<PatientChoice[]>([]),
    [choiceId, setChoiceId] = useState(''),
    [selectionError, setSelectionError] = useState(''),
    [patient, setPatient] = useState<SessionPatient | null>(null),
    [clinicalReview, setClinicalReview] = useState<ClinicalReviewState | null>(null),
    [voiceOn, setVoiceOn] = useState(() => localStorage.vdaVoiceOn !== 'false');

  const audio = useRef<HTMLAudioElement | null>(null);
  const uploadInput = useRef<HTMLInputElement | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const clinicalChatActive = Boolean(clinicalReview?.reviewRequested);

  useEffect(() => { localStorage.vdaVoiceOn = String(voiceOn); }, [voiceOn]);

  useEffect(() => {
    if (selectedSessionId) return;
    let active = true;
    setSelectionError('');
    listLocalPrototypePatients()
      .then((items) => {
        if (!active) return;
        setChoices(items);
        if (items[0]) setChoiceId(items[0].id);
      })
      .catch(() => { if (active) setSelectionError('Local patient data could not be loaded.'); });
    return () => { active = false; };
  }, [selectedSessionId]);

  useEffect(() => {
    let active = true;
    if (!selectedSessionId) {
      setSid(''); setPatient(null); setState('select'); return () => { active = false; };
    }
    setSid(selectedSessionId); setPatient(null); setList([]); setState('loading');
    getSessionPatientContext(undefined, selectedSessionId)
      .then((context) => {
        if (!active) return;
        setPatient(context.patient);
        if (context.patient?.language === 'hi' || context.patient?.language === 'en') setLang(context.patient.language);
        setState('ready');
      })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [selectedSessionId]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [list, clinicalReview, busy]);

  useEffect(() => {
    if (!sid || state !== 'ready') return;
    let active = true;
    getClinicalReviewState(undefined, sid)
      .then((next) => { if (active) setClinicalReview(next); })
      .catch(() => { if (active) setClinicalReview(null); });
    return () => { active = false; };
  }, [sid, state]);

  useEffect(() => {
    if (!sid || state !== 'ready' || !clinicalReview?.reviewRequested) return;
    let active = true;
    const refresh = () => getClinicalReviewState(undefined, sid)
      .then((next) => { if (active) setClinicalReview(next); })
      .catch(() => { if (active) setClinicalReview(null); });
    const interval = window.setInterval(refresh, 4_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [sid, state, clinicalReview?.reviewRequested]);

  async function speak(text: string) {
    if (!text) return;
    try {
      audio.current?.pause();
      const blob = await synthesizeVoice(text.slice(0, 2500), undefined, lang === 'hi' ? 'hi-IN' : 'en-IN');
      const url = URL.createObjectURL(blob);
      const player = new Audio(url);
      player.onended = () => URL.revokeObjectURL(url);
      audio.current = player;
      await player.play();
    } catch { /* Voice fallback */ }
  }

  async function ask(q: string) {
    if (!q || busy) return;
    const messageSentInClinicalChat = clinicalChatActive;
    if (!messageSentInClinicalChat) setList((x) => [...x, { q, createdAt: Date.now() }]);
    setInput("");
    setBusy(true);
    try {
      const turn = await sendTurn(sid, undefined, q, lang);
      if (turn.response_type === 'escalation') {
        setList((x) => [...x.map((message, index) => index === x.length - 1 && message.q === q ? { ...message, clinical: true } : message), { t: turn, createdAt: Date.now() }]);
        void getClinicalReviewState(undefined, sid)
          .then(setClinicalReview)
          .catch(() => undefined);
      } else if (turn.response_type === 'clinical-review') {
        void getClinicalReviewState(undefined, sid)
          .then(setClinicalReview)
          .catch(() => undefined);
      } else {
        setList((x) => [...x, { t: turn, createdAt: Date.now() }]);
      }
      const content: any = turn.content;
      const patientText = content.patient_text || content[lang] || content.en || content.hi || content.summary || content.reason || content.text || '';
      if (voiceOn && turn.response_type !== 'clinical-review') void speak(patientText);
    } catch (error: unknown) {
      const apiError = error instanceof ApiError ? error : undefined;
      const safeMessage = apiError?.patientSafeMessage?.[lang];
      setList((x) => [
        ...x,
        {
          e:
            safeMessage ||
            (lang === "hi"
              ? "VDA सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।"
              : "Unable to connect to VDA. Please try again."),
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function startSelectedPatient() {
    if (!choiceId || busy) return;
    setBusy(true);
    setSelectionError('');
    try {
      const session = await startLocalPrototypeSession(undefined, choiceId);
      navigate(`/vda/session/${session.session_id}`);
    } catch {
      setSelectionError('Unable to start a VDA session for the selected patient.');
      setBusy(false);
    }
  }

  async function uploadPrescription(file: File) {
    if (!sid || !file || uploading) return;
    
    setList((x) => [...x, { q: lang === 'hi' ? 'मैंने अपनी prescription upload की है।' : 'I have uploaded my prescription.', createdAt: Date.now() }]);
    
    setUploading(true);
    setBusy(true);

    try {
      const record = await uploadSessionPrescription(undefined, sid, file);
      setList((x) => [...x, {
        t: {
          intent: 'PRESCRIPTION_QUERY',
          response_type: 'text',
          content: {
            summary: lang === 'hi' ? 'धन्यवाद। मैंने आपकी prescription पढ़ ली है:' : 'Thank you. I have read your prescription:',
            prescription: record
          }
        } as Turn,
        createdAt: Date.now(),
      }]);
    } catch (error: unknown) {
      const apiError = error instanceof ApiError ? error : undefined;
      const safeMessage = apiError?.patientSafeMessage?.[lang];
      const message = safeMessage || (lang === 'hi'
        ? ({
            UPLOAD_FAILED: 'Prescription upload में समस्या आई। कृपया पुनः प्रयास करें।',
            PRESCRIPTION_EXTRACTION_FAILED: 'Prescription की जानकारी पूरी तरह नहीं पढ़ी जा सकी। कृपया साफ़ फोटो या PDF अपलोड करें।',
            PRESCRIPTION_SERVICE_UNAVAILABLE: 'पर्चा पढ़ने की सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।',
            GEMINI_UNAVAILABLE: 'पर्चा पढ़ने की सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद दोबारा प्रयास करें।',
            UNSUPPORTED_FILE: 'कृपया समर्थित PDF या Image (JPG/PNG) फाइल अपलोड करें।',
            INVALID_FILE: 'चुनी गई फाइल अमान्य या खाली है।',
          }[apiError?.code || 'UPLOAD_FAILED'] || 'Prescription upload में समस्या आई। कृपया पुनः प्रयास करें।')
        : ({
            UPLOAD_FAILED: 'Prescription upload failed. Please try again.',
            PRESCRIPTION_EXTRACTION_FAILED: 'Could not read this prescription clearly. Please upload a clearer photo or PDF.',
            PRESCRIPTION_SERVICE_UNAVAILABLE: 'Prescription service is temporarily unavailable. Please try again later.',
            GEMINI_UNAVAILABLE: 'Prescription service is temporarily unavailable. Please try again later.',
            UNSUPPORTED_FILE: 'Please upload a supported PDF or Image file.',
            INVALID_FILE: 'The selected file is invalid or empty.',
          }[apiError?.code || 'UPLOAD_FAILED'] || 'Prescription upload failed. Please try again.'));
      setList((x) => [...x, { e: message, createdAt: Date.now() }]);
    } finally {
      setUploading(false);
      setBusy(false);
    }
  }

  if (state !== "ready")
    return (
      <main className="patient">
        <section className="phone loading patient-selection">
          {state === 'loading' && (lang === 'hi' ? 'सत्र लोड हो रहा है...' : 'Loading patient session...')}
          {state === 'select' && (
            <>
              <h1>VDA Health</h1>
              <p>Select a local prototype patient to start a separate VDA session.</p>
              {choices.length > 0 ? <>
                <label htmlFor="patient-selection">Patient</label>
                <select id="patient-selection" value={choiceId} onChange={(event) => setChoiceId(event.target.value)}>
                  {choices.map((choice) => <option key={choice.id} value={choice.id}>{[choice.name, choice.age ? `Age ${choice.age}` : '', choice.gender, choice.district, choice.state].filter(Boolean).join(' • ')}</option>)}
                </select>
                <button disabled={!choiceId || busy} onClick={() => void startSelectedPatient()}>{busy ? 'Starting…' : 'Continue'}</button>
              </> : <p>{selectionError || 'No local prototype patients are available.'}</p>}
              {selectionError && choices.length > 0 && <p role="alert">{selectionError}</p>}
              <small style={{ marginTop: '12px', display: 'block', color: '#64748b' }}>LOCAL PROTOTYPE DATA — DEMO ONLY</small>
            </>
          )}
          {state === 'error' && (
            <>
              <p>{lang === 'hi' ? 'सत्र लोड करने में असमर्थ।' : 'Unable to load session.'}</p>
              <button onClick={() => navigate('/vda')}>
                {lang === 'hi' ? 'रोगी चयन पर वापस जाएँ' : 'Back to patient selection'}
              </button>
            </>
          )}
        </section>
      </main>
    );

  const timeline = [
    ...list.filter((message) => !message.clinical).map((message, index) => ({ kind: 'normal' as const, at: message.createdAt, index, message })),
    ...(clinicalReview?.messages || []).map((message, index) => ({ kind: 'clinical' as const, at: Date.parse(message.createdAt), index, message })),
  ].sort((left, right) => left.at - right.at || left.index - right.index);

  return (
    <main className="patient">
      <section className="phone">
        <header className="patient-header">
          <div className="patient-brand"><b>🏥 VDA Health</b><small>🟢 Online / Ready</small></div>
          <div className="patient-controls">
            <button
              className={lang === "hi" ? "active" : ""}
              onClick={() => setLang("hi")}
            >
              हिंदी
            </button>
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              English
            </button>
            <button aria-pressed={voiceOn} onClick={() => { audio.current?.pause(); setVoiceOn((value) => !value); }}>
              {voiceOn ? '🔊 Voice ON' : '🔇 Voice OFF'}
            </button>
          </div>
        </header>

        <section className={`patient-identity ${clinicalChatActive ? 'clinical-chat-active' : ''}`} aria-label="Selected patient">
          <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>👤 </span>
          <div>
            <b>{patient?.name}</b>
            <small>Age: {patient?.age ?? 'Not recorded'} • {patient?.gender || 'Male'}</small>
            <p>{patient?.conditions?.length ? patient.conditions.join(' • ') : 'No conditions recorded.'}</p>
          </div>
          <em style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontStyle: 'normal', fontSize: '0.7rem', fontWeight: 600 }}>
            {patient?.dataSource === 'local-file' ? 'LOCAL PROTOTYPE PATIENT' : 'DEVELOPMENT / SYNTHETIC PATIENT'}
          </em>
        </section>

        {clinicalChatActive && <ClinicalChatBanner lang={lang} showTeleconsultation={Boolean(clinicalReview?.teleconsultationOffered)} />}

        <div className={`messages ${clinicalChatActive ? 'clinical-chat-messages' : ''}`}>
          <article className="bubble">
            <p>
              {lang === "hi"
                ? `नमस्ते ${patient?.name || ''} जी। मैं आपका VDA Health Assistant हूँ।${patient?.conditions?.length ? ` आपके स्वास्थ्य रिकॉर्ड में ${patient.conditions.join(', ')} दर्ज है।` : ''} मैं आपके उपलब्ध स्वास्थ्य रिकॉर्ड के आधार पर आपकी दवाइयों, रिपोर्ट्स, prescriptions, adherence, सरकारी योजनाओं और नजदीकी अस्पतालों के बारे में मदद कर सकता हूँ।`
                : `Hello ${patient?.name || ''}. I am your VDA Health Assistant.${patient?.conditions?.length ? ` Your health record lists ${patient.conditions.join(', ')}.` : ''} I can help you understand your medicines, reports, prescriptions, adherence, government schemes, and nearby hospitals.`}
            </p>
          </article>
          {timeline.map((entry) => entry.kind === 'normal'
            ? <MessageView key={`normal-${entry.index}`} m={entry.message} lang={lang} onSpeak={speak} onAsk={ask} activeMeds={patient?.medications || []} />
            : <ClinicalMessageView key={`clinical-${entry.message.createdAt}-${entry.index}`} message={entry.message} lang={lang} />)}
          {busy && (
            <article className="bubble typing">
              {lang === 'hi' ? 'VDA उत्तर लिख रहा है...' : 'VDA is typing...'}
            </article>
          )}
          <div ref={chatEnd} />
        </div>

        {!clinicalChatActive && <div className="quick">
          {quick[lang].map((label) => (
            <button key={label} onClick={() => ask(quickQuery[label])}>
              {label}
            </button>
          ))}
        </div>}

        {!clinicalChatActive && <section className="prescription-upload-compact">
          <div className="upload-info">
            <b>📄 {lang === 'hi' ? 'Prescription अपलोड करें' : 'Upload Prescription'}</b>
            <p>{lang === 'hi' ? 'दवाइयों और जांच की जानकारी समझने के लिए prescription अपलोड करें।' : 'Upload a prescription to understand medicines and tests.'}</p>
          </div>
          <input ref={uploadInput} className="sr-only" type="file" accept=".pdf,image/*,.txt,.md" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPrescription(file); e.currentTarget.value = ''; }} />
          <button type="button" className="upload-btn" disabled={uploading} onClick={() => uploadInput.current?.click()}>
            {uploading ? (lang === 'hi' ? 'पढा जा रहा है...' : 'Reading...') : (lang === 'hi' ? '📄 Upload Prescription' : '📄 Upload Prescription')}
          </button>
        </section>}

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <button type="button" className="composer-attach-btn" disabled={uploading || clinicalChatActive} onClick={() => uploadInput.current?.click()} title={lang === 'hi' ? 'Prescription अपलोड करें' : 'Upload prescription'}>
            📎
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              clinicalChatActive
                ? (lang === "hi" ? "क्लिनिकल टीम को अपना संदेश लिखें..." : "Write a message to the clinical team...")
                : (lang === "hi" ? "अपना प्रश्न यहाँ लिखें..." : "Type your question...")
            }
          />
          <VoiceInput language={lang} token={token} disabled={busy} onTranscript={ask} />
          <button>
            <Send />
          </button>
        </form>
      </section>
    </main>
  );
}

function ClinicalChatBanner({ lang, showTeleconsultation }: { lang: Language; showTeleconsultation: boolean }) {
  return <section className="clinical-chat-banner"><b>🩺 {lang === 'hi' ? 'क्लिनिकल टीम आपके संदेश की समीक्षा कर रही है' : 'Clinical Team is reviewing your message'}</b>{showTeleconsultation && <a className="action-chip" href="https://esanjeevani.mohfw.gov.in/" target="_blank" rel="noreferrer">{lang === 'hi' ? 'eSanjeevani पर बात करें' : 'Use eSanjeevani'}</a>}</section>;
}

function ClinicalMessageView({ message, lang }: { message: { speaker: 'PATIENT' | 'CLINICIAN'; text: string; createdAt: string }; lang: Language }) {
  const clinician = message.speaker === 'CLINICIAN';
  return <article className={`bubble clinical-message ${clinician ? 'clinical-team' : 'user me'}`}><b>{clinician ? `🩺 ${lang === 'hi' ? 'क्लिनिकल टीम' : 'Clinical Team'}` : (lang === 'hi' ? 'आप' : 'You')}</b><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>;
}

function MessageView({ m, lang, onSpeak, onAsk, activeMeds }: { m: Message; lang: Language; onSpeak: (t: string) => void; onAsk: (q: string) => void; activeMeds?: any[] }) {
  if (m.q) return <article className="bubble user"><p>{m.q}</p></article>;
  if (m.e) return <article className="bubble error"><p>{m.e}</p></article>;
  if (!m.t) return null;
  const turn = m.t;
  const content: any = turn.content || {};
  const text = content.summary || content[lang] || content.en || content.hi || content.reason || content.text || '';
  const prescription = content.prescription;

  return (
    <article className="bubble assistant">
      {text && <p>{text}</p>}
      {content.sections?.length > 0 && (
        <div className="response-sections">
          {content.sections.map((section: any, idx: number) => (
            <section className="response-section" key={idx}>
              {section.title && <b>{section.title}</b>}
              {section.body && <p>{section.body}</p>}
              {section.bullets?.length > 0 && (
                <ul>{section.bullets.map((bullet: string, bulletIndex: number) => <li key={bulletIndex}>{bullet}</li>)}</ul>
              )}
            </section>
          ))}
        </div>
      )}
      {prescription && <PrescriptionSummary record={prescription} lang={lang} onAsk={onAsk} activeMeds={activeMeds} />}
      {content.cards?.length > 0 && (
        <div className="cards-grid">
          {content.cards.map((c: any, idx: number) => (
            <div key={idx} className="card-item">
              <b>{c.title}</b>
              <p>{c.value}</p>
              <small>{c.subtitle}</small>
            </div>
          ))}
        </div>
      )}
      {content.actions?.length > 0 && (
        <div className="actions-chips">
          {content.actions.map((a: any, idx: number) => (
            <button key={idx} className="action-chip" onClick={() => onAsk(a.action || a.label)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function PrescriptionSummary({ record, lang, onAsk, activeMeds = [] }: { record: any; lang: Language; onAsk: (q: string) => void; activeMeds?: any[] }) {
  const medicines = record.medications || [];
  const investigations = record.investigations || [];
  const doctor = record.prescriberName;
  const date = record.prescriptionDate;

  return (
    <section className="card prescription-summary-card">
      <div className="prescription-card-header">
        <span className="prescription-header-icon">📄</span>
        <div style={{ flex: 1 }}>
          <b className="prescription-title">{lang === 'hi' ? 'Prescription जानकारी' : 'Prescription information'}</b>
          {doctor || date ? (
            <div className="prescription-meta">
              {[
                doctor && `${lang === 'hi' ? 'डॉक्टर: ' : 'Dr. '}${doctor}`,
                date && `${lang === 'hi' ? 'दिनांक: ' : 'Date: '}${typeof date === 'string' ? date.split('T')[0] : String(date).split('T')[0]}`
              ].filter(Boolean).join(' • ')}
            </div>
          ) : (
            <div className="prescription-meta-none">
              {lang === 'hi' ? 'डॉक्टर/दिनांक का विवरण उपलब्ध नहीं है' : 'Doctor/date not specified'}
            </div>
          )}
        </div>
      </div>

      <div className="prescription-card-body">
        {medicines.length > 0 && (
          <div className="prescription-section">
            <span className="section-title">{lang === 'hi' ? 'दवाइयाँ (Medicines)' : 'Medicines'}</span>
            <div className="medication-list">
              {medicines.map((medicine: any, index: number) => {
                const medName = medicine.medicationName || medicine.name || 'Unknown Medicine';
                const dosage = medicine.dosage || medicine.strength || '';
                const frequency = medicine.frequency || '';
                const timing = medicine.instructions || medicine.duration || '';

                return (
                  <div key={index} className="medication-item">
                    <div className="med-primary">
                      <b className="med-name">{medName}</b>
                      {dosage && <span className="med-dosage">{dosage}</span>}
                    </div>
                    {(frequency || timing) && (
                      <div className="med-instructions">
                        {frequency && <span>{frequency}</span>}
                        {timing && <span> • {timing}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {investigations.length > 0 && (
          <div className="prescription-section">
            <span className="section-title">{lang === 'hi' ? 'जाँच (Tests / Investigations)' : 'Investigations / Tests'}</span>
            <ul className="investigation-list">
              {investigations.map((test: any, index: number) => (
                <li key={index}>
                  {test.rawName || test.normalizedName || test.name || 'Unnamed test'}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="prescription-actions-container" style={{ marginTop: '12px' }}>
          <div className="actions-chips">
            <button className="action-chip" onClick={() => onAsk(lang === 'hi' ? 'इस दवाई से क्या होता है?' : 'What does this medicine do?')}>
              💊 {lang === 'hi' ? 'इस दवाई से क्या होता है?' : 'What does this medicine do?'}
            </button>
            <button className="action-chip" onClick={() => onAsk(lang === 'hi' ? 'ये टेस्ट क्यों हैं?' : 'Why are these tests recommended?')}>
              🧪 {lang === 'hi' ? 'ये टेस्ट क्यों हैं?' : 'Why these tests?'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
