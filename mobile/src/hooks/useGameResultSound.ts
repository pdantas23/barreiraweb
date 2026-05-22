import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const VICTORY_FILE = require("../../assets/victory.mp3");
const DEFEAT_FILE = require("../../assets/defeat.mp3");

let victorySound: Audio.Sound | null = null;
let defeatSound: Audio.Sound | null = null;
let loadPromise: Promise<void> | null = null;

const ensureLoaded = async () => {
  if (victorySound && defeatSound) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loadPromise = (async () => {
    const [v, d] = await Promise.all([
      Audio.Sound.createAsync(VICTORY_FILE),
      Audio.Sound.createAsync(DEFEAT_FILE),
    ]);
    victorySound = v.sound;
    defeatSound = d.sound;
  })();
  await loadPromise;
};

const playResult = async (victory: boolean) => {
  try {
    await ensureLoaded();
    const sound = victory ? victorySound : defeatSound;
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // non-critical
  }
};

export const stopResultSound = async () => {
  try {
    if (victorySound) await victorySound.stopAsync();
    if (defeatSound) await defeatSound.stopAsync();
  } catch {
    // non-critical
  }
};

// Plays victory/defeat sound when the modal becomes visible.
// Stops immediately when visible becomes false.
export const useGameResultSound = (visible: boolean, isVictory: boolean, sfxEnabled: boolean) => {
  const played = useRef(false);

  useEffect(() => {
    ensureLoaded();
  }, []);

  useEffect(() => {
    if (visible && sfxEnabled && !played.current) {
      played.current = true;
      playResult(isVictory);
    }
    if (!visible) {
      played.current = false;
      stopResultSound();
    }
  }, [visible, isVictory, sfxEnabled]);

  // Stop on unmount (user leaves screen)
  useEffect(() => {
    return () => {
      stopResultSound();
    };
  }, []);
};
