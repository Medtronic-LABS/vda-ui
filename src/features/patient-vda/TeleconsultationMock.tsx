import { useState } from 'react';
import type { Language } from '../../types/api';

export function TeleconsultationMock({ language }: { language: Language }) {
  const [state, setState] = useState<'REQUESTED' | 'QUEUED' | 'READY' | 'JOINED' | 'COMPLETED'>('REQUESTED');
  const hi = language === 'hi';
  return <section className="tele-card" aria-label="Demo teleconsultation">
    <strong>{hi ? 'डॉक्टर से बात करने के लिए आगे बढ़ें' : 'Continue to speak with a doctor'}</strong>
    <small>DEMO ONLY — {hi ? 'कोई वास्तविक परामर्श नहीं बनाया जा रहा है।' : 'No real consultation is being created.'}</small>
    {state === 'REQUESTED' && <button onClick={() => setState('QUEUED')}>{hi ? 'Start Teleconsultation' : 'Start Teleconsultation'}</button>}
    {state !== 'REQUESTED' && <><p>{hi ? 'डॉक्टर' : 'Doctor'}: Demo Doctor<br />{hi ? 'विशेषज्ञता' : 'Speciality'}: General Physician<br />{hi ? 'स्थिति' : 'Status'}: Demo consultation<br />{hi ? 'अनुमानित प्रतीक्षा' : 'Estimated wait'}: Demo</p>{state === 'QUEUED' && <button onClick={() => setState('READY')}>{hi ? 'डेमो तैयार करें' : 'Prepare demo'}</button>}{state === 'READY' && <button onClick={() => setState('JOINED')}>{hi ? 'Join consultation' : 'Join consultation'}</button>}{state === 'JOINED' && <button onClick={() => setState('COMPLETED')}>{hi ? 'डेमो पूरा करें' : 'Complete demo'}</button>}{state === 'COMPLETED' && <small>{hi ? 'डेमो परामर्श समाप्त हुआ।' : 'Demo consultation completed.'}</small>}</>}</section>;
}
