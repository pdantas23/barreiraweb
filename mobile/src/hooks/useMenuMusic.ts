import { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const MUSIC_FILE = require("../../assets/piano.mp3");

// ─── Config ───
const MASTER_VOLUME = 0.4;
const CROSSFADE_MS = 3000;
const POLL_MS = 200;
const FADE_STEPS = Math.ceil(CROSSFADE_MS / POLL_MS);

// ─── Crossfade controller (module singleton) ───

let playerA: Audio.Sound | null = null;
let playerB: Audio.Sound | null = null;
let activePlayer: "A" | "B" = "A";
let crossfading = false;
let crossfadeStep = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let durationMs = 0;
let playing = false;
let loadPromise: Promise<void> | null = null;

const getActive = () => (activePlayer === "A" ? playerA : playerB);
const getInactive = () => (activePlayer === "A" ? playerB : playerA);

const ensureLoaded = async () => {
  if (playerA && playerB) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loadPromise = (async () => {
    const [a, b] = await Promise.all([
      Audio.Sound.createAsync(MUSIC_FILE, { volume: MASTER_VOLUME, isLooping: false }),
      Audio.Sound.createAsync(MUSIC_FILE, { volume: 0, isLooping: false }),
    ]);
    playerA = a.sound;
    playerB = b.sound;
    const status = await playerA.getStatusAsync();
    if (status.isLoaded && status.durationMillis) {
      durationMs = status.durationMillis;
    }
  })();
  await loadPromise;
};

const startCrossfade = async () => {
  if (crossfading) return;
  crossfading = true;
  crossfadeStep = 0;

  const incoming = getInactive();
  if (!incoming) return;

  try {
    await incoming.setPositionAsync(0);
    await incoming.setVolumeAsync(0);
    await incoming.playAsync();
  } catch {
    crossfading = false;
  }
};

const tickCrossfade = async () => {
  if (!crossfading) return;
  crossfadeStep++;
  const progress = Math.min(crossfadeStep / FADE_STEPS, 1);

  const outgoing = getActive();
  const incoming = getInactive();
  if (!outgoing || !incoming) return;

  try {
    await outgoing.setVolumeAsync(MASTER_VOLUME * (1 - progress));
    await incoming.setVolumeAsync(MASTER_VOLUME * progress);
  } catch {
    // non-critical
  }

  if (progress >= 1) {
    crossfading = false;
    crossfadeStep = 0;
    try {
      await outgoing.pauseAsync();
      await outgoing.setPositionAsync(0);
    } catch {
      // non-critical
    }
    activePlayer = activePlayer === "A" ? "B" : "A";
  }
};

const poll = async () => {
  if (!playing) return;

  if (crossfading) {
    await tickCrossfade();
    return;
  }

  const active = getActive();
  if (!active) return;

  try {
    const status = await active.getStatusAsync();
    if (!status.isLoaded) return;
    const pos = status.positionMillis;
    const dur = status.durationMillis ?? durationMs;
    if (dur > 0 && pos >= dur - CROSSFADE_MS) {
      await startCrossfade();
    }
  } catch {
    // non-critical
  }
};

const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(poll, POLL_MS);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

// ─── Public API ───

const play = async () => {
  await ensureLoaded();
  playing = true;
  crossfading = false;
  crossfadeStep = 0;
  activePlayer = "A";

  try {
    if (playerA) {
      await playerA.setPositionAsync(0);
      await playerA.setVolumeAsync(MASTER_VOLUME);
      await playerA.playAsync();
    }
    if (playerB) {
      await playerB.pauseAsync();
      await playerB.setPositionAsync(0);
      await playerB.setVolumeAsync(0);
    }
  } catch {
    // non-critical
  }
  startPolling();
};

const stop = async () => {
  playing = false;
  crossfading = false;
  stopPolling();
  try {
    if (playerA) {
      await playerA.pauseAsync();
      await playerA.setPositionAsync(0);
    }
    if (playerB) {
      await playerB.pauseAsync();
      await playerB.setPositionAsync(0);
    }
  } catch {
    // non-critical
  }
};

export const stopMenuMusic = stop;

// ─── Hook ───

export const useMenuMusic = (enabled: boolean) => {
  const wasEnabled = useRef(enabled);

  useEffect(() => {
    ensureLoaded();
  }, []);

  useEffect(() => {
    wasEnabled.current = enabled;
    if (enabled) {
      play();
    } else {
      stop();
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);
};
