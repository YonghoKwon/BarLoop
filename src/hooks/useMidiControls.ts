import { useCallback, useEffect, useRef, useState } from 'react';

export interface MidiMappings {
  togglePlayback: number;
  previous: number;
  restart: number;
  next: number;
}

interface MidiMessageEventLike {
  data: Uint8Array;
}

interface MidiInputLike {
  id: string;
  name?: string | null;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
}

interface MidiAccessLike {
  inputs: Map<string, MidiInputLike>;
  onstatechange: (() => void) | null;
}

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MidiAccessLike>;
};

interface MidiControlCallbacks {
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onNext: () => void;
}

interface MidiControlsResult {
  supported: boolean;
  enabled: boolean;
  connectedInputs: string[];
  lastNote: number | null;
  error: string;
  enable: () => Promise<void>;
  disable: () => void;
}

export function useMidiControls(
  mappings: MidiMappings,
  callbacks: MidiControlCallbacks,
): MidiControlsResult {
  const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  const accessRef = useRef<MidiAccessLike | null>(null);
  const mappingsRef = useRef(mappings);
  const callbacksRef = useRef(callbacks);
  const lastTriggerRef = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [connectedInputs, setConnectedInputs] = useState<string[]>([]);
  const [lastNote, setLastNote] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    mappingsRef.current = mappings;
  }, [mappings]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const detachInputs = useCallback(() => {
    const access = accessRef.current;
    if (!access) return;
    access.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
  }, []);

  const attachInputs = useCallback((access: MidiAccessLike) => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      names.push(input.name || `MIDI ${input.id}`);
      input.onmidimessage = (event) => {
        const [status = 0, note = 0, velocity = 0] = event.data;
        const command = status & 0xf0;
        if (command !== 0x90 || velocity === 0) return;
        setLastNote(note);

        const now = performance.now();
        if (now - lastTriggerRef.current < 130) return;
        lastTriggerRef.current = now;
        const current = mappingsRef.current;
        const actions = callbacksRef.current;
        if (note === current.togglePlayback) actions.onTogglePlayback();
        else if (note === current.previous) actions.onPrevious();
        else if (note === current.restart) actions.onRestart();
        else if (note === current.next) actions.onNext();
      };
    });
    setConnectedInputs(names);
  }, []);

  const enable = useCallback(async () => {
    const request = (navigator as unknown as NavigatorWithMidi).requestMIDIAccess;
    if (!request) {
      setError('이 브라우저는 Web MIDI를 지원하지 않습니다.');
      return;
    }
    try {
      const access = await request.call(navigator, { sysex: false });
      accessRef.current = access;
      attachInputs(access);
      access.onstatechange = () => attachInputs(access);
      setEnabled(true);
      setError('');
    } catch {
      setError('MIDI 권한을 허용하지 않았거나 장치를 열 수 없습니다.');
    }
  }, [attachInputs]);

  const disable = useCallback(() => {
    detachInputs();
    if (accessRef.current) accessRef.current.onstatechange = null;
    accessRef.current = null;
    setConnectedInputs([]);
    setEnabled(false);
  }, [detachInputs]);

  useEffect(() => () => disable(), [disable]);

  return { supported, enabled, connectedInputs, lastNote, error, enable, disable };
}
