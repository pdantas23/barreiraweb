import { useEffect, useRef } from "react";

let sharedAudio: HTMLAudioElement | null = null;
let sfxEnabled = true;

export const setSfxEnabledForWall = (v: boolean) => {
  sfxEnabled = v;
};

const ensureLoaded = () => {
  if (!sharedAudio) {
    sharedAudio = new Audio("/audio/wall.wav");
  }
};

export const playWallSound = () => {
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

export const useWallPlaceSound = (wallCount: number) => {
  const mounted = useRef(false);

  useEffect(() => {
    ensureLoaded();
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    playWallSound();
  }, [wallCount]);
};
