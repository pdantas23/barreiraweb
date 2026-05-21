import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const SOUND_FILE = require("../../assets/buttonclick1.mp3");

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

export const playButtonSound = async () => {
  try {
    await ensureLoaded();
    if (!sharedSound) return;
    await sharedSound.setPositionAsync(0);
    await sharedSound.playAsync();
  } catch {
    // silently ignore — sound is non-critical
  }
};

export const useButtonSound = () => {
  useEffect(() => {
    ensureLoaded();
  }, []);

  return playButtonSound;
};
