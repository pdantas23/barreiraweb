import { useEffect } from "react";

let sfxEnabled = true;
let preloaded = false;

export const setSfxEnabledForSounds = (v: boolean) => {
  sfxEnabled = v;
};

const ensureLoaded = () => {
  if (preloaded) return;
  preloaded = true;
  // Preload into browser cache
  const a = new Audio("/audio/buttonclick1.mp3");
  a.preload = "auto";
  a.load();
};

export const playButtonSound = () => {
  if (!sfxEnabled) return;
  try {
    const a = new Audio("/audio/buttonclick1.mp3");
    a.play().catch(() => {});
  } catch {
    // non-critical
  }
};

export const useButtonSound = () => {
  useEffect(() => {
    ensureLoaded();
  }, []);

  return playButtonSound;
};
