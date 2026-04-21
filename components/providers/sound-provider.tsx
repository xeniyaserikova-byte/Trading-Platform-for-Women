"use client";

import * as React from "react";
import {
  isSoundMuted,
  playSound as rawPlay,
  setSoundMuted as rawSetMuted,
  unlockSound,
  type SoundName,
} from "@/lib/sounds/ui-sounds";

interface SoundCtx {
  muted: boolean;
  play: (name: SoundName) => void;
  toggleMuted: () => void;
}

const Ctx = React.createContext<SoundCtx | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = React.useState<boolean>(true);
  // Hydrate the initial mute state from localStorage after mount to avoid
  // SSR/CSR divergence.
  React.useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  // Unlock audio on the very first user gesture anywhere on the page. This
  // gets Safari/iOS over the autoplay barrier.
  React.useEffect(() => {
    const onFirstGesture = () => {
      unlockSound();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  const play = React.useCallback((name: SoundName) => rawPlay(name), []);

  const toggleMuted = React.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      rawSetMuted(next);
      if (!next) {
        // user just un-muted → give them immediate feedback
        unlockSound();
        setTimeout(() => rawPlay("chime"), 40);
      }
      return next;
    });
  }, []);

  const value = React.useMemo<SoundCtx>(
    () => ({ muted, play, toggleMuted }),
    [muted, play, toggleMuted]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSound(): SoundCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    // Graceful fallback so components used outside the provider (tests,
    // storybook) don't crash.
    return {
      muted: true,
      play: () => undefined,
      toggleMuted: () => undefined,
    };
  }
  return ctx;
}
