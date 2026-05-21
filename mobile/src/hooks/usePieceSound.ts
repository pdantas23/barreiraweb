import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const SOUND_FILE = require("../../assets/peao.wav");

let sharedSound: Audio.Sound | null = null;
let loadingPromise: Promise<void> | null = null;

const ensureLoaded = async () => {
  if (sharedSound) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }
  loadingPromise = (async () => {
    const { sound } = await Audio.Sound.createAsync(SOUND_FILE);
    sharedSound = sound;
  })();
  await loadingPromise;
};

export const playPieceSound = async () => {
  try {
    await ensureLoaded();
    if (!sharedSound) return;
    await sharedSound.setPositionAsync(0);
    await sharedSound.playAsync();
  } catch {
    // non-critical
  }
};

// Plays the piece sound whenever p1 or p2 position changes.
// Skips the initial mount to avoid playing on screen load.
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
