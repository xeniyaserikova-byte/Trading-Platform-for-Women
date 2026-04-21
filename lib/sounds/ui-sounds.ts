/**
 * Tiny WebAudio-based UI sound library. No asset files — every sound is
 * synthesized from oscillators so the bundle stays small and the experience
 * loads instantly. Call `playSound(name)` from anywhere in a client component;
 * calls made before the browser unlocks audio (first user gesture) are no-ops.
 *
 * Respects `prefers-reduced-motion` by default and honours a user-facing
 * mute preference stored in localStorage under `ll:sound-muted`.
 */

const STORAGE_KEY = "ll:sound-muted";

export type SoundName =
  | "sparkle"
  | "pop"
  | "chime"
  | "select"
  | "success"
  | "celebrate"
  | "whoosh"
  | "tick"
  | "coin";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlocked = false;

/** Browser-safe access to the AudioContext. Returns null on the server. */
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  type AC = typeof AudioContext;
  const AudioCtor: AC | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Must be called from inside a user-gesture handler (click, keydown, etc.) to
 * unlock audio on iOS/Safari. Safe to call many times.
 */
export function unlockSound(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  unlocked = true;
}

function envelope(
  c: AudioContext,
  gainNode: GainNode,
  startAt: number,
  attack: number,
  decay: number,
  peak: number
) {
  const g = gainNode.gain;
  g.cancelScheduledValues(startAt);
  g.setValueAtTime(0, startAt);
  g.linearRampToValueAtTime(peak, startAt + attack);
  g.exponentialRampToValueAtTime(0.0001, startAt + attack + decay);
  // release node after it finishes playing
  setTimeout(() => {
    try {
      gainNode.disconnect();
    } catch {
      /* noop */
    }
  }, (attack + decay + 0.1) * 1000);
}

function tone(
  frequency: number,
  duration: number,
  options: {
    type?: OscillatorType;
    attack?: number;
    peak?: number;
    sweepTo?: number;
    delay?: number;
    detune?: number;
  } = {}
) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime + (options.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = options.type ?? "sine";
  osc.frequency.setValueAtTime(frequency, now);
  if (typeof options.detune === "number") {
    osc.detune.setValueAtTime(options.detune, now);
  }
  if (options.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(
      options.sweepTo,
      now + duration
    );
  }
  gain.gain.value = 0;
  osc.connect(gain).connect(masterGain);
  envelope(
    c,
    gain,
    now,
    options.attack ?? 0.006,
    duration,
    options.peak ?? 0.28
  );
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

function noise(duration: number, peak: number, bandpass?: number) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const bufSize = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    // gentle exponential decay so it reads like a quick shimmer
    const t = i / bufSize;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = peak;
  if (bandpass) {
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = bandpass;
    bp.Q.value = 2.2;
    src.connect(bp).connect(gain).connect(masterGain);
  } else {
    src.connect(gain).connect(masterGain);
  }
  const now = c.currentTime;
  src.start(now);
  src.stop(now + duration + 0.02);
  setTimeout(() => {
    try {
      gain.disconnect();
    } catch {
      /* noop */
    }
  }, (duration + 0.1) * 1000);
}

/* -------------------------------------------------------------------------- */
/* Public sound presets                                                       */
/* -------------------------------------------------------------------------- */

const PRESETS: Record<SoundName, () => void> = {
  /** Soft hover shimmer — two quick high sines with detune. */
  sparkle: () => {
    tone(1320, 0.08, { type: "sine", peak: 0.14 });
    tone(1760, 0.1, { type: "sine", peak: 0.1, delay: 0.04 });
    noise(0.08, 0.04, 2000);
  },
  /** Tactile button tap. */
  pop: () => {
    tone(540, 0.1, { type: "triangle", peak: 0.26, sweepTo: 360 });
  },
  /** Tiny list-item tick. */
  tick: () => {
    tone(880, 0.04, { type: "square", peak: 0.08 });
  },
  /** Balanced select/confirm click — friendlier than a pop. */
  select: () => {
    tone(660, 0.07, { type: "triangle", peak: 0.22 });
    tone(990, 0.09, { type: "sine", peak: 0.18, delay: 0.03 });
  },
  /** Short bright chime — page landing / section reveal. */
  chime: () => {
    tone(784, 0.22, { type: "sine", peak: 0.22 }); // G5
    tone(1175, 0.28, { type: "sine", peak: 0.2, delay: 0.06 }); // D6
    tone(1568, 0.38, { type: "sine", peak: 0.16, delay: 0.12 }); // G6
  },
  /** Positive confirmation — trade placed, plan selected. */
  success: () => {
    tone(659.25, 0.14, { type: "sine", peak: 0.22 }); // E5
    tone(783.99, 0.18, { type: "sine", peak: 0.22, delay: 0.08 }); // G5
    tone(1046.5, 0.28, { type: "sine", peak: 0.22, delay: 0.16 }); // C6
  },
  /** Plan purchased / checkout — a rising arpeggio with shimmer. */
  celebrate: () => {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5–E6
    notes.forEach((f, i) => {
      tone(f, 0.32, {
        type: "sine",
        peak: 0.22,
        delay: i * 0.07,
      });
    });
    noise(0.5, 0.05, 4500);
  },
  /** Airy transition swoosh for plan switch. */
  whoosh: () => {
    tone(220, 0.4, {
      type: "triangle",
      peak: 0.18,
      sweepTo: 880,
      attack: 0.02,
    });
    noise(0.35, 0.07, 1800);
  },
  /** Coin-clink for virtual-cash moves. */
  coin: () => {
    tone(1318, 0.06, { type: "triangle", peak: 0.2 });
    tone(1760, 0.18, { type: "triangle", peak: 0.22, delay: 0.05 });
  },
};

export function playSound(name: SoundName) {
  if (typeof window === "undefined") return;
  if (isSoundMuted()) return;
  if (prefersReducedMotion()) return;
  if (!unlocked) {
    // Queue the unlock on the first gesture but skip this invocation so we
    // never fire from a silent context.
    const handler = () => {
      unlockSound();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return;
  }
  try {
    PRESETS[name]?.();
  } catch {
    /* noop — if the browser refuses to synth, stay silent */
  }
}
