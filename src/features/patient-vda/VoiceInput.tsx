import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { transcribeVoice } from '../../api/vda';
import type { Language } from '../../types/api';

export function VoiceInput({ language, token, disabled, onTranscript }: { language: Language; token: string; disabled: boolean; onTranscript: (text: string) => void }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const [mode, setMode] = useState<'idle' | 'recording' | 'processing' | 'error'>('idle');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (mode !== 'recording') return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [mode]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      cancelled.current = false;
      setSeconds(0);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (cancelled.current) return setMode('idle');
        setMode('processing');
        try {
          const audio = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const result = await transcribeVoice(audio, token, language === 'hi' ? 'hi-IN' : 'en-IN');
          if (!result.transcript.trim()) throw new Error('empty transcript');
          setMode('idle');
          onTranscript(result.transcript.trim());
        } catch {
          setMode('error');
        }
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setMode('recording');
    } catch { setMode('error'); }
  }

  function stop(cancel = false) {
    cancelled.current = cancel;
    recorder.current?.stop();
    recorder.current = null;
  }

  if (mode === 'recording') return <div className="voice-recording" role="status"><span>🔴 {language === 'hi' ? 'सुन रहा हूं...' : 'Listening...'}</span><span>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><button type="button" aria-label="Stop recording" onClick={() => stop()}><Square /></button><button type="button" aria-label="Cancel recording" onClick={() => stop(true)}><X /></button></div>;
  if (mode === 'processing') return <span className="voice-status" role="status">{language === 'hi' ? 'आवाज़ समझी जा रही है...' : 'Understanding your voice...'}</span>;
  if (mode === 'error') return <button type="button" className="voice-error" onClick={() => setMode('idle')}>{language === 'hi' ? 'आवाज़ समझ नहीं आई। कृपया फिर से बोलें।' : 'Voice service is currently unavailable.'}</button>;
  return <button type="button" className="mic" disabled={disabled} aria-label={language === 'hi' ? 'आवाज़ से पूछें' : 'Ask by voice'} onClick={start}><Mic /></button>;
}
