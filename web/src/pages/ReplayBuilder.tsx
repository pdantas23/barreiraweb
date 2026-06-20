// === Replay Builder (interativo) ===
//
// Pagina interna (so em dev) pra montar partidas customizadas pra TikTok.
// Voce controla os DOIS jogadores manualmente: clica no tabuleiro pra mover
// o peao do jogador da vez, ou usa os dropdowns pra colocar parede.
// O engine garante alternancia e regras — moves invalidos sao rejeitados.
//
// Depois de montar a partida toda, usa "Tocar" pra rodar o replay em
// qualquer velocidade. "Exportar script" copia o roteiro em texto pra
// salvar/replicar.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyMove,
  canPlaceWall,
  getValidMoves,
  goalRow,
  hasPathToRow,
  initialState,
  piecePosition,
  registerWall,
  type GameState,
  type Move,
  type PlayerId,
  type WallPlacement,
  type WallType,
} from "@barreira/shared";
import { Board, type PlayerSkin } from "../components/Board";
import { WallBank } from "../components/WallBank";
import { useResponsiveBoard } from "../hooks/useResponsiveBoard";
import { useDragOverlay } from "../state/dragOverlay";
import { cellToNotation } from "./replayBuilder/coord";
import { COUNTRIES, countryByCode, flagUrl } from "./replayBuilder/countries";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  red: "#FF3D6F",
  redLight: "#FF7B9F",
  cyan: "#00B2D6",
};

const SPEEDS: { label: string; ms: number }[] = [
  { label: "0.5x", ms: 1600 },
  { label: "1x", ms: 800 },
  { label: "1.5x", ms: 533 },
  { label: "2x", ms: 400 },
  { label: "4x", ms: 200 },
];

const COL_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

// === Sons que dao pra anexar a moves individuais.
//     Cada linha da lista de jogadas tem um botaozinho que cicla entre as
//     opcoes abaixo. Quando o playback (ou clique direto na linha) chega
//     nessa jogada, o som toca.
type SoundKey = "punch" | "faaah";

const SOUNDS: Record<SoundKey, { label: string; emoji: string; src: string }> = {
  punch: { label: "Punch", emoji: "👊", src: "/audio/replay-builder/punch.mp3" },
  faaah: { label: "FAAAH", emoji: "📢", src: "/audio/replay-builder/faaah.mp3" },
};

// Ordem de ciclo no botao: nenhum -> punch -> faaah -> nenhum.
const SOUND_CYCLE: (SoundKey | null)[] = [null, "punch", "faaah"];
const nextSoundInCycle = (current: SoundKey | null): SoundKey | null => {
  const idx = SOUND_CYCLE.indexOf(current);
  return SOUND_CYCLE[(idx + 1) % SOUND_CYCLE.length];
};

// Quando o som toca em relacao a jogada.
//  - before:  toca ANTES de mostrar o move (durante a transicao do anterior)
//  - during:  toca no momento exato em que o move aparece (default)
//  - after:   toca DEPOIS do move, com pequeno delay
type SoundTiming = "before" | "during" | "after";

const TIMING_CYCLE: SoundTiming[] = ["before", "during", "after"];
const nextTimingInCycle = (current: SoundTiming): SoundTiming => {
  const idx = TIMING_CYCLE.indexOf(current);
  return TIMING_CYCLE[(idx + 1) % TIMING_CYCLE.length];
};

const timingLabel = (t: SoundTiming): string =>
  t === "before" ? "A" : t === "during" ? "D" : "P";
const timingFullLabel = (t: SoundTiming): string =>
  t === "before" ? "Antes" : t === "during" ? "Durante" : "Pós/Depois";

// Delay em ms pra "before" (toca X ms antes do move chegar) e "after"
// (toca X ms depois). Mantidos curtos pra nao sair do ritmo da partida.
const TIMING_LEAD_MS = 250;

type SoundEntry = { key: SoundKey; timing: SoundTiming };

type AppliedAction = {
  player: PlayerId;
  move: Move;
  raw: string;
};

const formatPawnMove = (from: number, to: number): string => {
  return `${cellToNotation(from)} ➔ ${cellToNotation(to)}`;
};

const formatWall = (type: "h" | "v", interCol: number, interRow: number): string => {
  const c1 = COL_LETTERS[interCol];
  const c2 = COL_LETTERS[interCol + 1];
  const r1 = interRow + 1;
  const r2 = interRow + 2;
  return `Barreira ${type === "h" ? "Horizontal" : "Vertical"} em ${c1}-${c2} (Linhas ${r1}/${r2})`;
};

const translateEngineError = (err: string): string => {
  switch (err) {
    case "not-your-turn": return "Nao eh o turno desse jogador";
    case "game-over": return "Jogo ja terminou";
    case "invalid-piece-move": return "Movimento de peao invalido";
    case "invalid-wall-placement": return "Posicao de parede invalida (cruza outra parede ou fora do range)";
    case "no-walls-left": return "Jogador nao tem mais paredes";
    case "wall-blocks-goal": return "Parede bloqueia totalmente o caminho de algum jogador";
    default: return err;
  }
};

export default function ReplayBuilderPage() {
  const layout = useResponsiveBoard();
  const boardRef = useRef<HTMLDivElement>(null);
  const { dragX, dragY, lastInter, show, hide } = useDragOverlay();

  // Qual jogador comeca. So pode mudar antes do primeiro move.
  const [firstTurn, setFirstTurn] = useState<PlayerId>(2);

  // === Skins de bandeira por jogador ===
  // "" = visual padrao (azul/vermelho). Cosmetico puro — pode trocar a
  // qualquer momento, nao entra no historico.
  const [countryFor, setCountryFor] = useState<{ 1: string; 2: string }>({ 1: "", 2: "" });

  const skins = useMemo<{ 1?: PlayerSkin; 2?: PlayerSkin }>(() => {
    const skinOf = (code: string): PlayerSkin | undefined => {
      const c = countryByCode(code);
      if (!c) return undefined;
      return { flagUrl: flagUrl(c.code), wallColor: c.wallColor };
    };
    return { 1: skinOf(countryFor[1]), 2: skinOf(countryFor[2]) };
  }, [countryFor]);

  // Imagens das bandeiras pro canvas de gravacao. crossOrigin="anonymous"
  // (circle-flags manda CORS *) — sem isso o canvas fica "tainted" e o
  // captureStream do video morre. Cache por codigo de pais.
  const flagImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    for (const code of [countryFor[1], countryFor[2]]) {
      if (!code || flagImgsRef.current.has(code)) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = flagUrl(code);
      flagImgsRef.current.set(code, img);
    }
  }, [countryFor]);

  // Historico das jogadas aplicadas. Tudo deriva daqui.
  const [history, setHistory] = useState<AppliedAction[]>([]);

  // Estado de playback
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);

  // Drag de parede (mesmo padrao do useLocalGame)
  const [dragType, setDragType] = useState<WallType | null>(null);
  const [ghost, setGhost] = useState<WallPlacement | null>(null);
  const [ghostInvalid, setGhostInvalid] = useState(false);

  // Sons anexados a cada move. Chave = numero do move (1-indexed).
  // Valor inclui o som E o timing (antes/durante/depois do move).
  const [soundsByMove, setSoundsByMove] = useState<Record<number, SoundEntry>>({});

  // === Sistema de audio via Web Audio API ===
  // Em vez de elementos <audio>, decodificamos os sons como AudioBuffers e
  // tocamos via AudioBufferSourceNode. Isso permite rotear pro speaker E pra
  // um MediaStreamDestination ao mesmo tempo, capturando o audio dentro do
  // video gravado sem precisar do "Compartilhar audio" do browser.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundBuffersRef = useRef<Map<SoundKey, AudioBuffer>>(new Map());
  const recordingAudioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const ensureAudioCtx = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Preload dos buffers no mount. fetch + decodeAudioData funcionam mesmo
  // antes da primeira interacao do usuario (ctx suspenso); so play() exige
  // resume(). Cache em ref pra evitar reload em re-renders.
  useEffect(() => {
    const preload = async () => {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      for (const k of Object.keys(SOUNDS) as SoundKey[]) {
        if (soundBuffersRef.current.has(k)) continue;
        try {
          const res = await fetch(SOUNDS[k].src);
          const arr = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          soundBuffersRef.current.set(k, buf);
        } catch (e) {
          console.warn("[replay-builder] falhou ao carregar som", k, e);
        }
      }
    };
    void preload();
  }, []);

  // Toca um som AGORA (usado pra previews e scrub manual).
  const playSound = (key: SoundKey) => {
    playSoundAt(key, 0);
  };

  // Toca um som em um momento futuro (offsetMs a partir de agora) usando
  // AudioContext.currentTime — agendamento sample-accurate, sem o jitter
  // de setTimeout. Imune a delays do event loop / re-render do React.
  const playSoundAt = (key: SoundKey, offsetMs: number) => {
    const ctx = ensureAudioCtx();
    const buffer = soundBuffersRef.current.get(key);
    if (!buffer) return; // ainda carregando — silencioso
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination); // speakers
    // Se estamos gravando, tambem roteia pro stream de captura do video
    if (recordingAudioDestRef.current) {
      src.connect(recordingAudioDestRef.current);
    }
    const when = ctx.currentTime + Math.max(0, offsetMs) / 1000;
    src.start(when);
  };

  // === Gravacao via canvas + Web Audio (sem captura de tela) ===
  // Renderiza o estado do jogo num canvas off-screen em alta resolucao
  // (1080x1080), captura como video stream via canvas.captureStream(),
  // mistura com o audio do AudioContext, e grava com MediaRecorder.
  // Vantagem: vai SO o tabuleiro, em 1080p, sem ruido visual da pagina,
  // e sem precisar pedir permissao de captura de tela.
  const RECORDING_SIZE = 1080;
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingCanvasRef = useRef<HTMLCanvasElement>(null);
  // Fonte silenciosa contínua pra manter o audio destination "alimentado"
  // desde o segundo 0 da gravação. Sem isso, o MediaRecorder marca t=0 no
  // primeiro sample de audio real que chega, fazendo sons agendados pro
  // futuro aparecerem no comeco do video.
  const silentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Desenha o tabuleiro no canvas. Chamado a cada mudanca de estado
  // durante gravacao + uma vez no start pra preencher o primeiro frame.
  const drawBoardToCanvas = (
    canvas: HTMLCanvasElement,
    state: GameState,
  ): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "#F0F4FF");
    grad.addColorStop(1, "#E8EEF8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Layout — 9 casas + 8 gaps, com padding generoso
    const padding = 48;
    const inner = size - padding * 2;
    const gap = 10;
    const square = (inner - gap * 8) / 9;

    // Casas
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const x = padding + c * (square + gap);
        const y = padding + r * (square + gap);
        // Sombra suave
        ctx.fillStyle = "rgba(61,111,255,0.04)";
        ctx.fillRect(x + 1, y + 3, square, square);
        // Casa
        ctx.fillStyle = "#FFFFFF";
        const radius = 10;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + square, y, x + square, y + square, radius);
        ctx.arcTo(x + square, y + square, x, y + square, radius);
        ctx.arcTo(x, y + square, x, y, radius);
        ctx.arcTo(x, y, x + square, y, radius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#DDEAFF";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Linhas finais (gols) coloridas
    const topGoalColor = "rgba(255,61,111,0.18)"; // P2 entra por cima (red)
    const bottomGoalColor = "rgba(0,178,214,0.18)"; // P1 vem de baixo (cyan)
    ctx.fillStyle = topGoalColor;
    ctx.fillRect(padding, padding - 8, inner, 6);
    ctx.fillStyle = bottomGoalColor;
    ctx.fillRect(padding, padding + 9 * square + 8 * gap + 2, inner, 6);

    // Paredes — skin de pais sobrepoe a cor padrao do dono
    for (const w of state.walls.placements) {
      const baseX = padding + w.interCol * (square + gap);
      const baseY = padding + w.interRow * (square + gap);
      const owner = (w.owner ?? 1) as 1 | 2;
      const wallColor =
        skins[owner]?.wallColor ?? (owner === 1 ? "#00B2D6" : "#FF3D6F");
      ctx.fillStyle = wallColor;
      if (w.type === "h") {
        // Horizontal: 2 casas de largura, na linha entre interRow e interRow+1
        ctx.fillRect(baseX, baseY + square, 2 * square + gap, gap);
      } else {
        // Vertical: 2 casas de altura, na coluna entre interCol e interCol+1
        ctx.fillRect(baseX + square, baseY, gap, 2 * square + gap);
      }
    }

    // Peoes — com bandeira circular se o jogador tem skin de pais
    const drawPawn = (
      pos: number,
      color: string,
      glow: string,
      flagImg: HTMLImageElement | null,
    ) => {
      const r = Math.floor(pos / 9);
      const c = pos % 9;
      const cx = padding + c * (square + gap) + square / 2;
      const cy = padding + r * (square + gap) + square / 2;
      const flagReady = !!flagImg && flagImg.complete && flagImg.naturalWidth > 0;
      // Com bandeira o peao eh maior e sem anel — a bandeira ocupa tudo.
      const radius = square * (flagReady ? 0.44 : 0.35);
      // Glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
      g.addColorStop(0, glow);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (flagReady) {
        // Bandeira recortada em circulo (circle-flags ja vem redonda, o
        // clip garante o encaixe exato).
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(flagImg!, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
      } else {
        // Peao solido (padrao / bandeira ainda carregando)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      // Brilho do topo
      const highlight = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        0,
        cx,
        cy,
        radius,
      );
      highlight.addColorStop(0, "rgba(255,255,255,0.5)");
      highlight.addColorStop(1, "transparent");
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };
    const flagFor = (player: 1 | 2): HTMLImageElement | null =>
      countryFor[player] ? (flagImgsRef.current.get(countryFor[player]) ?? null) : null;
    // Glow acompanha a cor da skin (ex.: Brasil = verde) com alpha em hex
    const glowFor = (player: 1 | 2, fallback: string): string => {
      const wallColor = skins[player]?.wallColor;
      return wallColor ? `${wallColor}80` : fallback;
    };
    drawPawn(state.p1, "#00B2D6", glowFor(1, "rgba(0,178,214,0.5)"), flagFor(1));
    drawPawn(state.p2, "#FF3D6F", glowFor(2, "rgba(255,61,111,0.5)"), flagFor(2));
  };

  // (canvas redraw effect movido pra depois da declaracao de currentState)

  const pickRecorderMime = (): string => {
    const candidates = [
      "video/mp4;codecs=h264,aac",
      "video/webm;codecs=h264,opus",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "video/webm";
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    // Para a fonte silenciosa contínua que mantinha o timeline alinhado
    if (silentSourceRef.current) {
      try { silentSourceRef.current.stop(); } catch { /* ja parado */ }
      silentSourceRef.current = null;
    }
    recordingAudioDestRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    if (history.length === 0) {
      setErrorMsg("Adicione ao menos uma jogada antes de gravar");
      return;
    }
    const canvas = recordingCanvasRef.current;
    if (!canvas) {
      setErrorMsg("Canvas de gravacao nao disponivel");
      return;
    }
    try {
      // Setup canvas em alta resolucao + frame inicial
      canvas.width = RECORDING_SIZE;
      canvas.height = RECORDING_SIZE;
      drawBoardToCanvas(canvas, states[0]);

      // Captura video do canvas (30fps)
      const videoStream = canvas.captureStream(30);

      // Setup destination de audio (rotear sons pra dentro do video)
      const ctx = ensureAudioCtx();
      const audioDest = ctx.createMediaStreamDestination();
      recordingAudioDestRef.current = audioDest;

      // Fonte silenciosa contínua: garante que o audio track tenha samples
      // desde o segundo 0 da gravação. Sem isso, sons agendados pro futuro
      // (via AudioContext.start(when)) aparecem no comeco do video porque
      // o MediaRecorder considera o primeiro sample como t=0.
      const silentBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuffer;
      silentSrc.loop = true;
      silentSrc.connect(audioDest);
      silentSrc.start();
      silentSourceRef.current = silentSrc;

      // Combina video + audio numa unica MediaStream
      const tracks = [
        ...videoStream.getTracks(),
        ...audioDest.stream.getTracks(),
      ];
      const combinedStream = new MediaStream(tracks);

      // Setup recorder com bitrate generoso pra qualidade alta
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 192_000,
      });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `barreira-replay-${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        videoStream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setRecording(true);

      // Reinicia o playback do comeco
      setPlaybackIndex(0);
      // Pequeno delay pra o canvas renderizar o estado inicial antes do play
      setTimeout(() => setPlaying(true), 300);
    } catch (err) {
      console.error("[replay-builder] erro ao iniciar gravacao", err);
      setErrorMsg("Erro ao iniciar gravacao");
    }
  };

  // Toca som quando o usuario CLICA numa jogada (scrub manual).
  // Durante autoplay, o agendamento eh feito no efeito acima (sample-accurate).
  // So fora do autoplay esse efeito dispara o som — evita double-play e
  // de-sincronia.
  const lastSoundIndexRef = useRef(-1);
  useEffect(() => {
    if (lastSoundIndexRef.current === playbackIndex) {
      // Se mudou apenas o "playing" mas o index ja foi processado, ignora
      return;
    }
    lastSoundIndexRef.current = playbackIndex;
    if (playing) return; // autoplay tem agendamento proprio
    if (playbackIndex === 0) return;
    const entry = soundsByMove[playbackIndex];
    if (!entry) return;
    playSound(entry.key);
  }, [playbackIndex, soundsByMove, playing]);

  // Mensagem temporaria de erro (3s)
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 3500);
    return () => clearTimeout(t);
  }, [errorMsg]);

  // Computa todos os estados a partir do historico.
  // states[0] = inicial, states[i] = apos aplicar a i-esima jogada.
  const states = useMemo<GameState[]>(() => {
    const result: GameState[] = [initialState(firstTurn)];
    let current = result[0];
    for (const act of history) {
      const r = applyMove(current, act.player, act.move);
      if (!r.ok) break; // historico invalido seria bug — paramos seguros
      current = r.state;
      result.push(current);
    }
    return result;
  }, [history, firstTurn]);

  const lastIndex = states.length - 1;
  const currentState = states[playbackIndex] ?? states[0];
  const isLatest = playbackIndex === lastIndex;
  const canEdit = isLatest && !playing && !currentState.winner;

  // Redesenha o canvas quando o estado muda durante gravacao (cada move).
  // skins nas deps: trocar o pais redesenha o frame na hora.
  useEffect(() => {
    if (!recording) return;
    const canvas = recordingCanvasRef.current;
    if (!canvas) return;
    drawBoardToCanvas(canvas, currentState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, currentState, skins]);

  // Auto-stop da gravacao quando o playback chega no final
  useEffect(() => {
    if (!recording) return;
    if (playing) return;
    if (playbackIndex < lastIndex) return;
    if (lastIndex === 0) return;
    // Espera ~1.2s depois do fim pra capturar o ultimo move + efeitos
    const t = setTimeout(() => stopRecording(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, playing, playbackIndex, lastIndex]);

  // Refs com valores atualizados pros callbacks de drag (pointer events
  // sao registrados via addEventListener e capturam closures stale senao).
  const stateRef = useRef(currentState);
  stateRef.current = currentState;
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;
  const ghostInvalidRef = useRef(ghostInvalid);
  ghostInvalidRef.current = ghostInvalid;
  const dragTypeRef = useRef(dragType);
  dragTypeRef.current = dragType;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  // Valid moves do jogador da vez (so quando dah pra editar)
  const validMoves = useMemo(() => {
    if (!canEdit) return new Set<number>();
    return new Set(getValidMoves(currentState, currentState.turn));
  }, [currentState, canEdit]);

  // === Acoes ===

  const tryApplyMove = (player: PlayerId, move: Move, raw: string): boolean => {
    const r = applyMove(currentState, player, move);
    if (!r.ok) {
      setErrorMsg(translateEngineError(r.error));
      return false;
    }
    const newAction: AppliedAction = { player, move, raw };
    setHistory((h) => [...h, newAction]);
    // Avanca o playback pro novo final
    setPlaybackIndex(lastIndex + 1);
    return true;
  };

  const handleSquareTap = (index: number) => {
    if (!canEdit) return;
    if (!validMoves.has(index)) return;
    const fromPos = piecePosition(currentState, currentState.turn);
    const player = currentState.turn;
    const raw = formatPawnMove(fromPos, index);
    tryApplyMove(player, { kind: "piece", to: index }, raw);
  };

  // === Drag de parede (mesmo padrao do useLocalGame) ===
  const onDragStart = (type: WallType) => {
    if (!canEditRef.current) return;
    const s = stateRef.current;
    if (s.wallsLeft[s.turn] <= 0) return;
    setDragType(type);
    setGhost(null);
    show(type, layout);
  };

  const onIntersectionChange = (ir: number, ic: number, type: WallType) => {
    const placement: WallPlacement = { type, interRow: ir, interCol: ic };
    const s = stateRef.current;
    if (canPlaceWall(s.walls, placement)) {
      // Sao paredes que cabem fisicamente — checa se nao bloqueiam caminho
      const nextWalls = registerWall(s.walls, { ...placement, owner: s.turn });
      const blocksPath =
        !hasPathToRow(nextWalls, s.p1, goalRow(1)) ||
        !hasPathToRow(nextWalls, s.p2, goalRow(2));
      setGhost(placement);
      setGhostInvalid(blocksPath);
    } else {
      setGhost(null);
      setGhostInvalid(false);
    }
  };

  const onIntersectionLeave = () => {
    setGhost(null);
    setGhostInvalid(false);
  };

  const onDragEnd = () => {
    if (dragTypeRef.current === null) return;
    const g = ghostRef.current;
    if (g && !ghostInvalidRef.current && canEditRef.current) {
      const s = stateRef.current;
      const raw = formatWall(g.type, g.interCol, g.interRow);
      tryApplyMove(s.turn, { kind: "wall", placement: g }, raw);
    }
    setDragType(null);
    setGhost(null);
    setGhostInvalid(false);
    hide();
  };

  const undoLast = () => {
    if (history.length === 0) return;
    const newLen = history.length - 1;
    setHistory((h) => h.slice(0, -1));
    // Remove o som anexado ao move que esta sendo desfeito (se houver)
    setSoundsByMove((s) => {
      if (!(history.length in s)) return s;
      const next = { ...s };
      delete next[history.length];
      return next;
    });
    setPlaybackIndex(newLen);
    setPlaying(false);
  };

  const resetAll = () => {
    if (!confirm("Apagar TODAS as jogadas e comecar do zero?")) return;
    setHistory([]);
    setSoundsByMove({});
    setPlaybackIndex(0);
    setPlaying(false);
  };

  const exportScript = async () => {
    const lines = history.map((a) => `P${a.player}: ${a.raw}`);
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setErrorMsg("Script copiado pra clipboard");
    } catch {
      // fallback: prompt
      prompt("Copia o script abaixo:", text);
    }
  };

  // === Playback autoplay ===
  // Quando esta tocando, agenda 2 coisas:
  //  1. Som do proximo move (pre-agendado via AudioContext.currentTime
  //     — sample accurate, evita drift do setTimeout)
  //  2. Timer pra avancar o playbackIndex apos speed.ms
  //
  // Sample-accuracy do audio + setTimeout do video acabam sincronizados
  // dentro de poucos ms.
  useEffect(() => {
    if (!playing) return;
    if (playbackIndex >= lastIndex) {
      setPlaying(false);
      return;
    }
    const totalMs = SPEEDS[speedIdx].ms;
    const nextMoveIndex = playbackIndex + 1;
    const nextEntry = soundsByMove[nextMoveIndex];

    // Agendamento sample-accurate dos sons em relacao ao "avanco"
    if (nextEntry) {
      if (nextEntry.timing === "before") {
        playSoundAt(nextEntry.key, Math.max(0, totalMs - TIMING_LEAD_MS));
      } else if (nextEntry.timing === "during") {
        playSoundAt(nextEntry.key, totalMs);
      } else if (nextEntry.timing === "after") {
        playSoundAt(nextEntry.key, totalMs + TIMING_LEAD_MS);
      }
    }

    const advanceTimer = setTimeout(() => {
      setPlaybackIndex((i) => Math.min(i + 1, lastIndex));
    }, totalMs);

    return () => {
      clearTimeout(advanceTimer);
      // Nota: nao da pra "cancelar" um AudioBufferSourceNode ja agendado
      // facilmente. Se pausar no meio, sons agendados ainda tocam.
      // Em pratica nao incomoda — pausa nao eh frequente.
    };
  }, [playing, playbackIndex, speedIdx, lastIndex, soundsByMove]);

  const togglePlay = () => {
    if (playbackIndex >= lastIndex) {
      setPlaybackIndex(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  };

  const currentTurn = currentState.turn;
  const turnLabel = currentState.winner
    ? `Vencedor: P${currentState.winner}`
    : `Vez do P${currentTurn}`;
  const turnColor = currentState.winner
    ? C.muted
    : currentTurn === 1
      ? C.cyan
      : C.red;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "1.75rem",
            color: C.blue,
            letterSpacing: 3,
          }}
        >
          REPLAY BUILDER
        </span>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 700 }}>(dev-only)</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px auto 320px",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* === Coluna esquerda: controles === */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Indicador de vez */}
          <div
            style={{
              backgroundColor: C.cardBg,
              border: `2px solid ${turnColor}`,
              borderRadius: 12,
              padding: "10px 12px",
              textAlign: "center",
              fontWeight: 800,
              fontSize: 15,
              color: turnColor,
            }}
          >
            {turnLabel}
          </div>

          {/* Quem comeca (so antes do primeiro move) */}
          {history.length === 0 && (
            <Section title="Quem comeca">
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setFirstTurn(1)}
                  style={firstTurn === 1 ? btnActive(C.cyan) : btnSecondary}
                >
                  P1 (Azul)
                </button>
                <button
                  onClick={() => setFirstTurn(2)}
                  style={firstTurn === 2 ? btnActive(C.red) : btnSecondary}
                >
                  P2 (Vermelho)
                </button>
              </div>
            </Section>
          )}

          {/* Skins de bandeira */}
          <Section title="Bandeiras dos jogadores">
            {([1, 2] as const).map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: p === 1 ? C.cyan : C.red, width: 22 }}>
                  P{p}
                </span>
                {countryFor[p] ? (
                  <img
                    src={flagUrl(countryFor[p])}
                    alt=""
                    style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0 }}
                  />
                ) : (
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: p === 1
                        ? `linear-gradient(135deg, ${C.cyan}, ${C.blue})`
                        : `linear-gradient(135deg, ${C.red}, ${C.redLight})`,
                    }}
                  />
                )}
                <select
                  value={countryFor[p]}
                  onChange={(e) => setCountryFor((s) => ({ ...s, [p]: e.target.value }))}
                  style={{ ...selectStyle, marginBottom: 0, flex: 1 }}
                >
                  <option value="">Padrão ({p === 1 ? "azul" : "vermelho"})</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
            <p style={{ ...infoText, color: C.muted, fontSize: 11 }}>
              Peão vira a bandeira do país e as barreiras usam a cor dela
              (ex.: Brasil = verde). Vale pra tela e pro vídeo gravado.
            </p>
          </Section>

          {/* Mover peao */}
          <Section title="Mover peão">
            {canEdit ? (
              <>
                <p style={infoText}>
                  Clica numa casa <b style={{ color: "#2E7D32" }}>verde clara</b>{" "}
                  no tabuleiro pra mover o P{currentTurn}.
                </p>
                <p style={{ ...infoText, color: C.muted, fontSize: 11 }}>
                  Posição atual do P{currentTurn}: <b>{cellToNotation(piecePosition(currentState, currentTurn))}</b>
                </p>
              </>
            ) : (
              <p style={{ ...infoText, color: C.muted }}>
                {playing
                  ? "Pause o playback pra editar"
                  : !isLatest
                    ? "Vá pro fim (▶▶) pra editar"
                    : "Jogo terminou"}
              </p>
            )}
          </Section>

          {/* Colocar parede via drag-and-drop (mesmo do jogo real) */}
          <Section title="Colocar parede (arrasta)">
            <p style={{ ...infoText, color: C.muted, fontSize: 11, marginBottom: 6 }}>
              Arraste o template <b>H</b> (horizontal) ou <b>V</b> (vertical) abaixo
              direto pra uma interseção no tabuleiro. Solta na posição certa e a
              parede é colocada.
            </p>
            <WallBank
              wallsLeft={currentState.wallsLeft[currentState.turn]}
              disabled={!canEdit}
              dragX={dragX}
              dragY={dragY}
              lastInter={lastInter}
              boardRef={boardRef}
              layout={layout}
              onDragStart={onDragStart}
              onIntersectionChange={onIntersectionChange}
              onIntersectionLeave={onIntersectionLeave}
              onDragEnd={onDragEnd}
            />
            <p style={{ ...infoText, color: C.muted, fontSize: 11, marginTop: 6 }}>
              Paredes restantes: P1={currentState.wallsLeft[1]}, P2={currentState.wallsLeft[2]}
            </p>
          </Section>

          {/* Acoes */}
          <Section title="Ações">
            <button
              onClick={undoLast}
              disabled={history.length === 0 || playing}
              style={history.length > 0 && !playing ? btnSecondary : btnDisabled}
            >
              ↶ Desfazer último
            </button>
            <button
              onClick={exportScript}
              disabled={history.length === 0}
              style={history.length > 0 ? btnSecondary : btnDisabled}
            >
              📋 Exportar script
            </button>
            <button onClick={resetAll} style={btnDanger}>
              ✕ Reiniciar tudo
            </button>
          </Section>

          {/* Erro temporario */}
          {errorMsg && (
            <div
              style={{
                backgroundColor: "#FFF1F4",
                border: `1px solid ${C.red}40`,
                borderRadius: 8,
                padding: 10,
                color: C.red,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* === Coluna central: tabuleiro + playback === */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Board
            state={currentState}
            validMoves={validMoves}
            ghost={ghost}
            ghostInvalid={ghostInvalid}
            onSquareTap={handleSquareTap}
            boardRef={boardRef}
            layout={layout}
            skins={skins}
          />

          {/* Controles de playback */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "8px 12px",
            }}
          >
            <button
              onClick={() => { setPlaybackIndex(0); setPlaying(false); }}
              style={btnSecondary}
            >
              ⏮ Início
            </button>
            <button onClick={togglePlay} style={btnPrimary}>
              {playing ? "⏸ Pausar" : "▶ Tocar"}
            </button>
            <button
              onClick={() => { setPlaybackIndex(lastIndex); setPlaying(false); }}
              style={btnSecondary}
            >
              Fim ⏭
            </button>
            <div style={{ width: 1, height: 24, backgroundColor: C.border, margin: "0 4px" }} />
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>VEL.</span>
            <select
              value={speedIdx}
              onChange={(e) => setSpeedIdx(Number(e.target.value))}
              style={{ ...selectStyle, marginBottom: 0, width: 80 }}
            >
              {SPEEDS.map((s, i) => (
                <option key={i} value={i}>{s.label}</option>
              ))}
            </select>
            <div style={{ width: 1, height: 24, backgroundColor: C.border, margin: "0 4px" }} />
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!recording && history.length === 0}
              title={
                recording
                  ? "Parar gravação e baixar o arquivo"
                  : "Iniciar gravação (vai pedir pra escolher janela/aba)"
              }
              style={{
                background: recording
                  ? `linear-gradient(to right, ${C.red}, ${C.redLight})`
                  : `linear-gradient(to right, ${C.cyan}, ${C.blue})`,
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontWeight: 800,
                fontSize: 12,
                cursor: history.length === 0 && !recording ? "not-allowed" : "pointer",
                opacity: history.length === 0 && !recording ? 0.4 : 1,
              }}
            >
              {recording ? "⏹ Parar grav." : "🎥 Gravar vídeo"}
            </button>
          </div>

          {/* Barra de progresso */}
          <div style={{ width: layout.boardSize, display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              type="range"
              min={0}
              max={Math.max(lastIndex, 0)}
              value={playbackIndex}
              onChange={(e) => { setPlaybackIndex(Number(e.target.value)); setPlaying(false); }}
              disabled={lastIndex === 0}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, fontWeight: 700 }}>
              <span>Move {playbackIndex} / {lastIndex}</span>
              <span>
                P1: {currentState.wallsLeft[1]}🧱 · P2: {currentState.wallsLeft[2]}🧱
              </span>
            </div>
          </div>
        </div>

        {/* === Coluna direita: lista de jogadas === */}
        <div
          style={{
            backgroundColor: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 12,
            maxHeight: layout.boardSize + 110,
            overflow: "auto",
          }}
        >
          <div style={{ color: C.navy, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            JOGADAS ({history.length})
          </div>
          {history.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12 }}>
              Comece movendo o peão (clique no tabuleiro) ou colocando uma parede.
            </div>
          )}
          {history.map((act, i) => {
            const moveNumber = i + 1;
            const isCurrent = moveNumber === playbackIndex;
            const entry = soundsByMove[moveNumber] ?? null;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  borderRadius: 6,
                  backgroundColor: isCurrent ? `${C.blue}15` : "transparent",
                  marginBottom: 1,
                }}
              >
                <button
                  onClick={() => { setPlaybackIndex(moveNumber); setPlaying(false); }}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 11,
                    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                    cursor: "pointer",
                    background: "transparent",
                    color: isCurrent ? C.blue : C.navy,
                    fontWeight: isCurrent ? 800 : 500,
                  }}
                >
                  {String(moveNumber).padStart(3, "0")}. P{act.player}: {act.raw}
                </button>

                {/* Botao do SOM: cicla nenhum -> 👊 -> 📢 -> nenhum.
                    Preserva o timing atual ao trocar de som. */}
                <button
                  onClick={() => {
                    setSoundsByMove((s) => {
                      const prev = s[moveNumber] ?? null;
                      const nextKey = nextSoundInCycle(prev?.key ?? null);
                      const next = { ...s };
                      if (nextKey === null) {
                        delete next[moveNumber];
                      } else {
                        next[moveNumber] = {
                          key: nextKey,
                          timing: prev?.timing ?? "during",
                        };
                      }
                      return next;
                    });
                    // Preview do novo som (se nao desanexou)
                    const nextKey = nextSoundInCycle(entry?.key ?? null);
                    if (nextKey) playSound(nextKey);
                  }}
                  title={
                    entry
                      ? `Som: ${SOUNDS[entry.key].label} — clique pra trocar/remover`
                      : "Sem som — clique pra anexar"
                  }
                  style={{
                    width: 28,
                    border: "none",
                    background: entry ? `${C.blue}20` : "transparent",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 0,
                    marginLeft: 4,
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  {entry ? SOUNDS[entry.key].emoji : "🔈"}
                </button>

                {/* Botao do TIMING: cicla A (antes) -> D (durante) -> P (depois).
                    So aparece se tiver som anexado. */}
                {entry && (
                  <button
                    onClick={() => {
                      setSoundsByMove((s) => {
                        const cur = s[moveNumber];
                        if (!cur) return s;
                        return { ...s, [moveNumber]: { ...cur, timing: nextTimingInCycle(cur.timing) } };
                      });
                    }}
                    title={`Timing: ${timingFullLabel(entry.timing)} — clique pra trocar`}
                    style={{
                      width: 24,
                      border: "none",
                      background:
                        entry.timing === "before"
                          ? `${C.cyan}30`
                          : entry.timing === "during"
                            ? `${C.blue}30`
                            : `${C.red}30`,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      padding: 0,
                      marginLeft: 2,
                      borderRadius: 4,
                      flexShrink: 0,
                      color:
                        entry.timing === "before"
                          ? C.cyan
                          : entry.timing === "during"
                            ? C.blue
                            : C.red,
                    }}
                  >
                    {timingLabel(entry.timing)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas oculto usado APENAS pra gravacao — renderiza o tabuleiro
          em 1080x1080 e captura via canvas.captureStream(). Fica no DOM
          (com display:none) pra captureStream funcionar. */}
      <canvas
        ref={recordingCanvasRef}
        width={RECORDING_SIZE}
        height={RECORDING_SIZE}
        style={{ display: "none" }}
      />
    </div>
  );
}

// === Componentes auxiliares ===

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      backgroundColor: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}
  >
    <span style={{ color: C.navy, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
      {title.toUpperCase()}
    </span>
    {children}
  </div>
);

// === Estilos ===

const infoText: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: C.navy,
  lineHeight: 1.4,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginTop: 4,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  fontSize: 12,
  fontWeight: 700,
  color: C.navy,
  backgroundColor: "white",
  cursor: "pointer",
  marginBottom: 6,
};

const btnPrimary: React.CSSProperties = {
  background: `linear-gradient(to right, ${C.blue}, ${C.blueLight})`,
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  backgroundColor: "white",
  color: C.navy,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "6px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  flex: 1,
};

const btnDisabled: React.CSSProperties = {
  ...btnSecondary,
  opacity: 0.4,
  cursor: "not-allowed",
};

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: C.red,
  borderColor: `${C.red}40`,
};

const btnActive = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  color: "white",
  border: `1px solid ${color}`,
  borderRadius: 8,
  padding: "6px 12px",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  flex: 1,
});
