import { useEffect, useRef } from "react";

let victoryAudio: HTMLAudioElement | null = null;
let defeatAudio: HTMLAudioElement | null = null;

const ensureLoaded = () => {
  if (!victoryAudio) victoryAudio = new Audio("/audio/victory.mp3");
  if (!defeatAudio) defeatAudio = new Audio("/audio/defeat.mp3");
};

const playResult = (victory: boolean) => {
  try {
    ensureLoaded();
    const audio = victory ? victoryAudio : defeatAudio;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // non-critical
  }
};

export const stopResultSound = () => {
  try {
    if (victoryAudio) { victoryAudio.pause(); victoryAudio.currentTime = 0; }
    if (defeatAudio) { defeatAudio.pause(); defeatAudio.currentTime = 0; }
  } catch {
    // non-critical
  }
};

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

  useEffect(() => {
    return () => {
      stopResultSound();
    };
  }, []);
};
