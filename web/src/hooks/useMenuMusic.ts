import { useEffect, useRef } from "react";

const MASTER_VOLUME = 0.4;
const CROSSFADE_MS = 3000;
const POLL_MS = 200;
const FADE_STEPS = Math.ceil(CROSSFADE_MS / POLL_MS);

let playerA: HTMLAudioElement | null = null;
let playerB: HTMLAudioElement | null = null;
let activePlayer: "A" | "B" = "A";
let crossfading = false;
let crossfadeStep = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let playing = false;

const getActive = () => (activePlayer === "A" ? playerA : playerB);
const getInactive = () => (activePlayer === "A" ? playerB : playerA);

const ensureLoaded = () => {
  if (playerA && playerB) return;
  playerA = new Audio("/audio/piano.mp3");
  playerA.volume = MASTER_VOLUME;
  playerB = new Audio("/audio/piano.mp3");
  playerB.volume = 0;
};

const startCrossfade = () => {
  if (crossfading) return;
  crossfading = true;
  crossfadeStep = 0;

  const incoming = getInactive();
  if (!incoming) return;

  incoming.currentTime = 0;
  incoming.volume = 0;
  incoming.play().catch(() => {});
};

const tickCrossfade = () => {
  if (!crossfading) return;
  crossfadeStep++;
  const progress = Math.min(crossfadeStep / FADE_STEPS, 1);

  const outgoing = getActive();
  const incoming = getInactive();
  if (!outgoing || !incoming) return;

  outgoing.volume = MASTER_VOLUME * (1 - progress);
  incoming.volume = MASTER_VOLUME * progress;

  if (progress >= 1) {
    crossfading = false;
    crossfadeStep = 0;
    outgoing.pause();
    outgoing.currentTime = 0;
    activePlayer = activePlayer === "A" ? "B" : "A";
  }
};

const poll = () => {
  if (!playing) return;

  if (crossfading) {
    tickCrossfade();
    return;
  }

  const active = getActive();
  if (!active) return;

  const pos = active.currentTime * 1000;
  const dur = (active.duration || 0) * 1000;
  if (dur > 0 && pos >= dur - CROSSFADE_MS) {
    startCrossfade();
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

const play = () => {
  ensureLoaded();
  playing = true;
  crossfading = false;
  crossfadeStep = 0;
  activePlayer = "A";

  if (playerA) {
    playerA.currentTime = 0;
    playerA.volume = MASTER_VOLUME;
    playerA.play().catch(() => {});
  }
  if (playerB) {
    playerB.pause();
    playerB.currentTime = 0;
    playerB.volume = 0;
  }
  startPolling();
};

const stop = () => {
  playing = false;
  crossfading = false;
  stopPolling();
  if (playerA) { playerA.pause(); playerA.currentTime = 0; }
  if (playerB) { playerB.pause(); playerB.currentTime = 0; }
};

export const stopMenuMusic = stop;

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
