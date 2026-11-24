import { useEffect, useRef, useState } from 'react';
import { LOCALE } from './locale';

// Dictation with the browser's speech recognition (Safari on iPhone, Chrome on Android).
// The phone's speech service (Apple or Google) turns the audio into text; Bruna only
// receives the text, which stays on the device like everything else.

interface Result {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<Result>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canDictate = () => typeof window !== 'undefined' && ctor() !== null;

const join = (a: string, b: string) => (!a.trim() ? b.trim() : !b.trim() ? a : `${a.trimEnd()} ${b.trim()}`);

/**
 * Dictate into a text box. `text`/`setText` are the box's value. While listening, what you
 * say is added after what was already there; nothing is sent until you tap Send.
 */
export function useDictation(text: string, setText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<Recognition | null>(null);
  const base = useRef('');
  const finals = useRef('');

  useEffect(() => () => rec.current?.stop(), []);

  function start() {
    const C = ctor();
    if (!C) return;
    setError('');
    const r = new C();
    r.lang = LOCALE;
    r.continuous = true;
    r.interimResults = true;
    base.current = text;
    finals.current = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current = join(finals.current, res[0].transcript);
        else interim = join(interim, res[0].transcript);
      }
      setText(join(join(base.current, finals.current), interim));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        setError('A Bruna não tem acesso ao microfone. Permite-o nas definições do telemóvel, ou usa o 🎤 do teclado.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Não foi possível ouvir. Tenta outra vez.');
    };
    r.onend = () => {
      setListening(false);
      // Keep only what was recognised for sure.
      setText(join(base.current, finals.current));
      rec.current = null;
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Não foi possível começar a ouvir. Tenta outra vez.');
    }
  }

  function stop() {
    rec.current?.stop();
  }

  return { listening, error, start, stop, supported: canDictate() };
}
