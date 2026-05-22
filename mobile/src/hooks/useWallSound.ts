import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const SOUND_FILE = require("../../assets/wall.wav");

let sharedSound: Audio.Sound | null = null;
let loadingPromise: Promise<void> | null = null;
let sfxEnabled = true;

export const setSfxEnabledForWall = (v: boolean) => {
  sfxEnabled = v;
};

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

export const playWallSound = async () => {
  if (!sfxEnabled) return;
  try {
    await ensureLoaded();
    if (!sharedSound) return;
    await sharedSound.setPositionAsync(0);
    await sharedSound.playAsync();
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
