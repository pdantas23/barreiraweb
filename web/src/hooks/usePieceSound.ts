import { useEffect, useRef } from "react";

let sharedAudio: HTMLAudioElement | null = null;
let sfxEnabled = true;

export const setSfxEnabledForPiece = (v: boolean) => {
  sfxEnabled = v;
};

const ensureLoaded = () => {
  if (!sharedAudio) {
    sharedAudio = new Audio("/audio/peao.wav");
  }
};

export const playPieceSound = () => {
  if (!sfxEnabled) return;
  try {
    ensureLoaded();
    if (!sharedAudio) return;
    sharedAudio.currentTime = 0;
    sharedAudio.play().catch(() => {});
  } catch {
    // non-critical
  }
};

export const usePieceMoveSound = (p1: number, p2: number) => {
  const mounted = useRef(false);

  useEffect(() => {
    ensureLoaded();
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    playPieceSound();
  }, [p1, p2]);
};
