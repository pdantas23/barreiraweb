// === Home / Lobby unificado ===
//
// Pagina principal do site. Em telas grandes (>= lg) layout em 3 colunas:
//   [Leaderboard 288px] [Lobby flex-1] [Quick Play 288px]
// No mobile vira uma coluna so, com Quick Play e Leaderboard logo abaixo
// das salas dentro do scroll. Inspirado em barricade.gg.
//
// Aglutina o que antes ficava em Home + Online em uma unica rota "/".
// O treino (vs Computador) virou um card a direita, abrindo o modal de
// dificuldade. A rota /online foi removida; useOnlineGame.ts agora usa "/".

import { useCallback, useEffect, useState } from "react";
import {
  IoAdd,
  IoArrowForward,
  IoChevronForward,
  IoFlash,
  IoGameController,
  IoKeyOutline,
  IoLockClosed,
  IoMusicalNotes,
  IoPeopleOutline,
  IoRefresh,
  IoSettingsOutline,
  IoShieldCheckmark,
  IoVolumeHigh,
} from "react-icons/io5";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ColorChoice, PublicRoom } from "@barreira/shared";
import { CreateRoomModal, type CreateRoomConfig } from "../components/CreateRoomModal";
import { IosAppPromo } from "../components/IosAppPromo";
import { JoinByCodeModal } from "../components/JoinByCodeModal";
import { MessageModal } from "../components/MessageModal";
import { PageGate } from "../components/PageGate";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";
import { Leaderboard } from "../components/Leaderboard";
import { createRoom, joinRoom, listRooms } from "../net/api";
import { clearLastGameStart, connectSocket } from "../net/socket";
import {
  playButtonSound,
  setSfxEnabledForSounds,
  useButtonSound,
} from "../hooks/useButtonSound";
import { useMenuMusic } from "../hooks/useMenuMusic";
import { setSfxEnabledForPiece } from "../hooks/usePieceSound";
import { setSfxEnabledForWall } from "../hooks/useWallSound";
import { useAudioSettings } from "../state/audioSettings";
import { usePlayerName } from "../state/profile";

const PRIVACY_ACCEPTED_KEY = "privacy_accepted";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  cellBg: "#EEF2FF",
  border: "#DDEAFF",
  red: "#FF3D6F",
} as const;

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Facil" },
  { key: "medium", label: "Medio" },
  { key: "hard", label: "Dificil" },
];

const colorAccent = (c: ColorChoice): string => {
  if (c === "cyan") return C.blue;
  if (c === "red") return C.red;
  return C.muted;
};

const colorLabel = (c: ColorChoice): string => {
  if (c === "cyan") return "Ciano";
  if (c === "red") return "Vermelho";
  return "Random";
};

type FriendlyError = { title: string; message: string };

const errorInfo = (err: string): FriendlyError => {
  switch (err) {
    case "room-not-found":
      return { title: "Sala nao encontrada", message: "Essa sala nao existe mais ou o codigo nao confere. Tente atualizar a lista ou conferir o codigo." };
    case "room-full":
      return { title: "Sala cheia", message: "Essa sala ja tem dois jogadores. Procure outra ou crie uma nova." };
    case "wrong-password":
      return { title: "Senha incorreta", message: "A senha digitada nao confere com a dessa sala. Confirme com quem criou a partida." };
    case "already-in-room":
      return { title: "Voce ja esta numa sala", message: "Saia da sala atual antes de entrar em outra." };
    case "self-match":
      return { title: "Voce nao pode jogar contra si mesmo", message: "Essa sala foi criada pela sua propria conta em outra sessao. Procure outra sala ou crie uma nova." };
    case "internal-error":
      return { title: "Sem conexao", message: "Nao conseguimos falar com o servidor agora. Verifique sua internet e tente de novo." };
    default:
      return { title: "Algo deu errado", message: "Nao foi possivel concluir essa acao. Tente novamente em alguns segundos." };
  }
};

export default function HomeScreen() {
  useButtonSound();
  const navigate = useNavigate();
  const playerName = usePlayerName();
  const { musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled } = useAudioSettings();
  useMenuMusic(musicEnabled);

  // Modais de menu/config
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Treino (vs Computador)
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [offlineModal, setOfflineModal] = useState(false);

  // Lobby online
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState<PublicRoom | null>(null);
  const [errorPopup, setErrorPopup] = useState<FriendlyError | null>(null);

  // Audio + privacy bootstrap
  useEffect(() => {
    setSfxEnabledForSounds(sfxEnabled);
    setSfxEnabledForPiece(sfxEnabled);
    setSfxEnabledForWall(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    if (!localStorage.getItem(PRIVACY_ACCEPTED_KEY)) setShowPrivacy(true);
  }, []);

  const onAcceptPrivacy = () => {
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, "1");
    setShowPrivacy(false);
  };

  // === Lobby data ===
  const showError = (res: { error: string; message?: string }) => {
    setErrorPopup(errorInfo(res.error));
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listRooms();
    setLoading(false);
    setFirstLoadDone(true);
    if (!res.ok) {
      showError(res);
      return;
    }
    setRooms(res.data.rooms);
  }, []);

  useEffect(() => {
    clearLastGameStart();
    const socket = connectSocket();
    refresh();
    // Server avisa quando o conjunto de salas waiting muda — sem isso o
    // user precisaria apertar refresh pra ver sala nova/morta.
    const onLobbyUpdated = () => {
      refresh();
    };
    socket.on("lobbyUpdated", onLobbyUpdated);
    return () => {
      socket.off("lobbyUpdated", onLobbyUpdated);
    };
  }, [refresh]);

  const goToOnlineGame = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    navigate(`/online-game?${sp.toString()}`);
  };

  // === Deep-link: alguém abriu /?join=CODE[&pw=PWD] (ex: link compartilhado
  // por WhatsApp). Auto-entra na sala — se for self-match, o popup de erro
  // padrão cuida da mensagem. Limpa os params da URL pra um refresh não
  // re-disparar o join.
  const [searchParams, setSearchParams] = useSearchParams();
  const autoJoinCode = searchParams.get("join");
  const autoJoinPw = searchParams.get("pw");
  useEffect(() => {
    if (!autoJoinCode) return;
    const code = autoJoinCode.toUpperCase().trim();
    const pw = autoJoinPw ?? undefined;
    setSearchParams({}, { replace: true });
    (async () => {
      setBusy(true);
      const res = await joinRoom({ code, playerName, password: pw });
      setBusy(false);
      if (!res.ok) {
        showError(res);
        return;
      }
      const params: Record<string, string> = { role: "guest", code };
      if (pw) params.password = pw;
      goToOnlineGame(params);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoinCode, autoJoinPw]);

  const onJoinRoom = async (room: PublicRoom) => {
    playButtonSound();
    if (busy) return;
    if (room.isPrivate) {
      setJoinTarget(room);
      setJoinOpen(true);
      return;
    }
    setBusy(true);
    const res = await joinRoom({ code: room.code, playerName });
    setBusy(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    goToOnlineGame({ role: "guest", code: room.code });
  };

  const onConfirmCreate = async (config: CreateRoomConfig) => {
    playButtonSound();
    setCreateOpen(false);
    setBusy(true);
    const res = await createRoom({ hostName: playerName, color: config.color, isPrivate: config.isPrivate });
    setBusy(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    goToOnlineGame({ role: "host", code: res.data.code, password: res.data.password ?? "" });
  };

  const onConfirmJoin = async (code: string, password: string) => {
    setJoinOpen(false);
    setJoinTarget(null);
    setBusy(true);
    const res = await joinRoom({ code, playerName, password: password || undefined });
    setBusy(false);
    if (!res.ok) {
      showError(res);
      return;
    }
    const params: Record<string, string> = { role: "guest", code };
    if (password) params.password = password;
    goToOnlineGame(params);
  };

  // === Treino (vs Computador) ===
  const onStartOffline = () => {
    playButtonSound();
    setOfflineModal(false);
    navigate(`/game?difficulty=${difficulty}`);
  };

  return (
    <PageGate ready={firstLoadDone}>
      {/* Mobile: a página inteira scrolla como bloco único (overflow-y-auto no
          container). Desktop: overflow-hidden + colunas com scroll próprio. */}
      <div className="h-full overflow-y-auto lg:overflow-hidden flex flex-col bg-gradient-to-b from-[#F0F4FF] to-[#E8EEF8]">
        {/* === Header === */}
        <header className="flex items-center px-4 py-3 z-10 border-b border-brand/8 bg-white">
          <div className="flex-1 flex items-center">
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.75rem", color: C.blue, letterSpacing: 3 }}>
              BARREIRA
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <HeaderAuthButtons />
            <button
              onClick={() => { playButtonSound(); setShowSettings(true); }}
              className="w-9 h-9 rounded-full bg-white border border-cell-bg flex items-center justify-center cursor-pointer hover:opacity-80"
              aria-label="Configuracoes"
            >
              <IoSettingsOutline size={16} color="#9AAACA" />
            </button>
          </div>
        </header>

        {/* === Body responsivo: 3 colunas no desktop, 1 fluindo no mobile ===
            No mobile não há flex-1/min-h-0 (sem altura travada) → o conteúdo
            cresce e o container externo scrolla tudo junto. */}
        <div className="flex flex-col lg:flex-1 lg:flex-row lg:overflow-hidden lg:min-h-0">
          {/* Sidebar esquerda: leaderboard (desktop). No mobile vai no topo do main. */}
          <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:flex-shrink-0 lg:border-r lg:border-[#DDEAFF] lg:overflow-auto lg:p-3 lg:bg-white/40">
            <Leaderboard />
          </aside>

          {/* Coluna central: lobby. Mobile flui (sem altura travada); desktop
              é flex-1 com scroll interno na lista de salas. */}
          <main className="flex flex-col lg:flex-1 lg:min-h-0">
            {/* Leaderboard no topo (mobile) — ordem: leaderboard → salas → quick play.
                No desktop fica na sidebar esquerda (lg:hidden aqui). */}
            <Leaderboard className="lg:hidden mx-3 mt-3" />

            {/* Barra de status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 12px" }}>
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {loading ? "Carregando..." : `${rooms.length} sala${rooms.length === 1 ? "" : "s"} disponive${rooms.length === 1 ? "l" : "is"}`}
              </span>
              <button
                onClick={refresh}
                disabled={loading || busy}
                style={{
                  width: 32, height: 32, borderRadius: 16, backgroundColor: C.white,
                  border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", opacity: (loading || busy) ? 0.5 : 1,
                }}
                aria-label="Atualizar salas"
              >
                {loading ? (
                  <div style={{ width: 16, height: 16, border: `2px solid ${C.muted}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <IoRefresh size={16} color={C.blue} />
                )}
              </button>
            </div>

            {/* Lista de salas. No mobile flui (sem scroll próprio); no desktop
                é a área rolável da coluna central (lg:overflow-auto). */}
            <div className="px-5 pb-2 lg:flex-1 lg:min-h-0 lg:overflow-auto">
              {rooms.length === 0 && !loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", justifyContent: "center" }}>
                  <IoPeopleOutline size={48} color={C.border} />
                  <span style={{ color: C.navy, fontSize: 15, fontWeight: 700, marginTop: 14 }}>Nenhuma sala aberta agora</span>
                  <span style={{ color: C.muted, fontSize: 12, textAlign: "center", marginTop: 6 }}>Crie uma nova sala ou entre com um codigo.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {rooms.map((item, index) => {
                    const accent = colorAccent(item.hostColor);
                    return (
                      <div
                        key={item.code}
                        style={{
                          display: "flex", flexDirection: "row", alignItems: "stretch",
                          backgroundColor: C.cardBg, borderRadius: 16,
                          border: `1px solid ${C.border}`, overflow: "hidden",
                          boxShadow: `0 2px 8px ${C.blue}0f`,
                          animation: `fadeInUp 360ms ease-out ${80 + index * 70}ms both`,
                        }}
                      >
                        <div style={{ width: 5, alignSelf: "stretch", backgroundColor: accent }} />
                        <div style={{ flex: 1, padding: "14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ color: C.navy, fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.hostName}</span>
                            {item.isPrivate && <IoLockClosed size={13} color={C.muted} />}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${accent}`, color: accent, fontSize: 10, fontWeight: 900, letterSpacing: 0.5 }}>
                              {colorLabel(item.hostColor)}
                            </span>
                            <span style={{ color: C.border, fontSize: 12 }}>·</span>
                            <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>{item.isPrivate ? "Privada" : "Publica"}</span>
                            <span style={{ color: C.border, fontSize: 12 }}>·</span>
                            <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, fontVariantNumeric: "tabular-nums" }}>{item.code}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onJoinRoom(item)}
                          disabled={busy}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            backgroundColor: C.blue, padding: "0 14px",
                            margin: "10px 10px 10px 0", borderRadius: 10,
                            border: "none", cursor: "pointer",
                            opacity: busy ? 0.5 : 1, color: C.white,
                            fontWeight: 900, fontSize: 13, letterSpacing: 0.5,
                          }}
                        >
                          Entrar <IoArrowForward size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Play (mobile) — acima da barra de ações. No desktop fica
                na sidebar direita (lg:hidden aqui). */}
            <QuickPlayCard className="lg:hidden mx-3 mt-4 mb-2" onPlay={() => { playButtonSound(); setOfflineModal(true); }} />

            {/* Bottom bar (Entrar com codigo / Criar sala). No mobile fica no
                rodape, logo acima dos links; no desktop, pinada no fim da coluna. */}
            <div
              style={{
                display: "flex", flexDirection: "row", gap: 10,
                padding: "12px 20px 16px",
                borderTop: `1px solid ${C.border}`,
                backgroundColor: "rgba(255,255,255,0.85)",
              }}
            >
              <button
                onClick={() => { playButtonSound(); setJoinOpen(true); }}
                disabled={busy}
                style={{
                  flex: 1, display: "flex", flexDirection: "row", gap: 6,
                  padding: "14px 0", borderRadius: 12, backgroundColor: C.white,
                  border: `1px solid ${C.border}`, alignItems: "center",
                  justifyContent: "center", cursor: "pointer",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <IoKeyOutline size={18} color={C.navy} />
                <span style={{ color: C.navy, fontWeight: 700, fontSize: 13 }}>Entrar com codigo</span>
              </button>
              <button
                onClick={() => { playButtonSound(); setCreateOpen(true); }}
                disabled={busy}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 12,
                  background: `linear-gradient(to right, ${C.blue}, ${C.blueLight})`,
                  border: "none", display: "flex", flexDirection: "row", gap: 8,
                  alignItems: "center", justifyContent: "center", cursor: "pointer",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <IoAdd size={20} color={C.white} />
                <span style={{ color: C.white, fontWeight: 900, fontSize: 14, letterSpacing: 0.5 }}>Criar sala</span>
              </button>
            </div>
          </main>

          {/* Sidebar direita: Quick Play (vs Computador) - so desktop */}
          <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:flex-shrink-0 lg:border-l lg:border-[#DDEAFF] lg:overflow-auto lg:p-3 lg:bg-white/40">
            <QuickPlayCard onPlay={() => { playButtonSound(); setOfflineModal(true); }} />
          </aside>
        </div>

        {/* === Footer com links de conteudo === */}
        <footer className="flex-shrink-0 flex flex-row items-center justify-center gap-3 py-3 px-4 border-t border-cell-bg bg-white/60">
          <button
            onClick={() => { playButtonSound(); navigate("/regras"); }}
            className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
          >
            Regras
          </button>
          <span className="text-muted text-[11px]">·</span>
          <button
            onClick={() => { playButtonSound(); navigate("/estrategias"); }}
            className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
          >
            Estratégias
          </button>
          <span className="text-muted text-[11px]">·</span>
          <button
            onClick={() => { playButtonSound(); navigate("/sobre"); }}
            className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
          >
            Sobre
          </button>
          <span className="text-muted text-[11px]">·</span>
          <button
            onClick={() => { playButtonSound(); navigate("/privacy"); }}
            className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
          >
            Privacidade
          </button>
        </footer>

        {/* === Modais === */}

        {/* Dificuldade do treino */}
        {offlineModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[200]" onClick={() => setOfflineModal(false)}>
            <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
              <span className="text-lg font-extrabold text-navy mb-5">Escolha a dificuldade</span>

              <div className="flex flex-row gap-2.5 mb-4 w-[280px]">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.key;
                  return (
                    <button
                      key={d.key}
                      onClick={() => { playButtonSound(); setDifficulty(d.key); }}
                      className={`flex-1 py-2.5 rounded-3xl border-[1.5px] text-sm font-bold cursor-pointer transition-colors ${
                        active ? "bg-brand border-brand text-white" : "bg-white border-muted text-muted"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-row gap-2.5 mt-5 w-full">
                <button
                  onClick={() => setOfflineModal(false)}
                  className="flex-1 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80"
                >
                  Cancelar
                </button>
                <button
                  onClick={onStartOffline}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
                >
                  Jogar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacidade primeira visita */}
        {showPrivacy && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[300]">
            <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]">
              <div className="mb-2"><IoShieldCheckmark size={36} color="#3D6FFF" /></div>
              <span className="text-lg font-extrabold text-navy mb-5">Politica de Privacidade</span>
              <div className="max-h-80 overflow-auto w-full">
                <p className="text-[13px] text-[#4A5C7A] leading-relaxed">
                  O Barreira coleta apenas um identificador de sessao aleatorio para permitir reconexao durante partidas online. Nao coletamos dados pessoais, nao usamos analytics nem publicidade.
                  <br /><br />
                  Seu nome de exibicao e visivel aos oponentes durante a partida e nao e armazenado permanentemente.
                  <br /><br />
                  Ao continuar, voce concorda com nossa Politica de Privacidade completa, acessivel a qualquer momento no menu do app.
                </p>
              </div>
              <button
                onClick={onAcceptPrivacy}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
              >
                Aceitar e Continuar
              </button>
            </div>
          </div>
        )}

        {/* Configuracoes */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[300]" onClick={() => setShowSettings(false)}>
            <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2"><IoSettingsOutline size={32} color="#3D6FFF" /></div>
              <span className="text-lg font-extrabold text-navy mb-5">Configuracoes</span>

              <SettingRow icon={<IoMusicalNotes size={20} color="#1A2A4A" />} label="Musica">
                <Toggle active={musicEnabled} onToggle={() => setMusicEnabled(!musicEnabled)} />
              </SettingRow>
              <SettingRow icon={<IoVolumeHigh size={20} color="#1A2A4A" />} label="Efeitos sonoros">
                <Toggle active={sfxEnabled} onToggle={() => setSfxEnabled(!sfxEnabled)} />
              </SettingRow>
              <div
                onClick={() => { setShowSettings(false); navigate("/privacy"); }}
                className="flex flex-row items-center justify-between w-full py-3.5 border-b border-cell-bg cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <IoShieldCheckmark size={20} color="#1A2A4A" />
                  <span className="text-[15px] font-semibold text-navy">Politica de Privacidade</span>
                </div>
                <IoChevronForward size={18} color="#9AAACA" />
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="mt-4 px-8 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Modais do lobby */}
        <CreateRoomModal visible={createOpen} onClose={() => setCreateOpen(false)} onConfirm={onConfirmCreate} />
        <JoinByCodeModal
          visible={joinOpen}
          onClose={() => { setJoinOpen(false); setJoinTarget(null); }}
          onConfirm={onConfirmJoin}
          initialCode={joinTarget?.code ?? ""}
          requirePassword={joinTarget?.isPrivate ?? false}
          codeLocked={!!joinTarget}
        />
        <MessageModal
          visible={errorPopup !== null}
          variant="error"
          title={errorPopup?.title}
          message={errorPopup?.message ?? ""}
          onClose={() => setErrorPopup(null)}
        />

        {/* Popup de download do app iOS — auto-gated (só iPhone/iPad, 1x por
            sessão, delay de 1.5s). Em Android/desktop não renderiza nada. */}
        <IosAppPromo />
      </div>
    </PageGate>
  );
}

// === Card de Quick Play (vs Computador) ===
// Reutilizado nas duas posicoes: sidebar direita no desktop e dentro da
// area de scroll no mobile.
const QuickPlayCard = ({ className = "", onPlay }: { className?: string; onPlay: () => void }) => (
  <div
    className={`bg-white rounded-2xl border border-[#DDEAFF] shadow-[0_2px_8px_rgba(61,111,255,0.06)] overflow-hidden ${className}`}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDEAFF] bg-gradient-to-r from-[#F5F8FF] to-white">
      <div className="flex items-center gap-2">
        <IoFlash size={16} color="#3D6FFF" />
        <span className="text-navy text-[12px] font-extrabold tracking-[1px]">QUICK PLAY</span>
      </div>
    </div>
    <div className="p-3 flex flex-col gap-2">
      <button
        onClick={onPlay}
        className="bg-gradient-to-r from-brand to-brand-light text-white rounded-xl py-4 px-3 flex flex-col items-center justify-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 transition-all border-none"
      >
        <IoGameController size={26} color="#FFFFFF" />
        <span className="text-[14px] font-black tracking-wide">vs Computador</span>
        <span className="text-[10px] font-semibold opacity-90">Treino offline</span>
      </button>
    </div>
  </div>
);

const SettingRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex flex-row items-center justify-between w-full py-3.5 border-b border-cell-bg">
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="text-[15px] font-semibold text-navy">{label}</span>
    </div>
    {children}
  </div>
);

const Toggle = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`w-12 h-7 rounded-full border-none flex items-center px-0.5 cursor-pointer transition-colors duration-200 ${
      active ? "bg-brand justify-end" : "bg-gray-300 justify-start"
    }`}
  >
    <div className="w-6 h-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
  </button>
);
