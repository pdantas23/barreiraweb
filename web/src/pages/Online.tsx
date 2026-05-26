import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoChevronBack, IoRefresh, IoLockClosed, IoArrowForward, IoPeopleOutline, IoKeyOutline, IoAdd } from "react-icons/io5";
import type { ColorChoice, PublicRoom } from "@barreira/shared";
import { CreateRoomModal, type CreateRoomConfig } from "../components/CreateRoomModal";
import { JoinByCodeModal } from "../components/JoinByCodeModal";
import { MessageModal } from "../components/MessageModal";
import { PageGate } from "../components/PageGate";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";
import { Leaderboard } from "../components/Leaderboard";
import { createRoom, joinRoom, listRooms } from "../net/api";
import { clearLastGameStart, connectSocket } from "../net/socket";
import { playButtonSound, useButtonSound } from "../hooks/useButtonSound";
import { usePlayerName } from "../state/profile";

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
    case "internal-error":
      return { title: "Sem conexao", message: "Nao conseguimos falar com o servidor agora. Verifique sua internet e tente de novo." };
    default:
      return { title: "Algo deu errado", message: "Nao foi possivel concluir essa acao. Tente novamente em alguns segundos." };
  }
};

export default function OnlineScreen() {
  useButtonSound();
  const navigate = useNavigate();
  const playerName = usePlayerName();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState<PublicRoom | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [errorPopup, setErrorPopup] = useState<FriendlyError | null>(null);

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
    connectSocket();
    refresh();
  }, [refresh]);

  const goToOnlineGame = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    navigate(`/online-game?${sp.toString()}`);
  };

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

  return (
    <PageGate ready={firstLoadDone}>
    <div
      style={{
        height: "100%",
        background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px" }}>
        <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
          <IoChevronBack size={28} color={C.navy} />
        </button>
        <span style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem", color: "#3D6FFF", letterSpacing: 4, textAlign: "center" }}>LOBBY</span>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", minWidth: 40 }}>
          <HeaderAuthButtons />
        </div>
      </div>

      {/* Body: em telas >= lg vira 2 colunas (lobby + sidebar leaderboard).
          No mobile e coluna unica e o leaderboard aparece dentro do scroll. */}
      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">
       <div className="flex-1 flex flex-col min-h-0">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 20px 12px" }}>
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
        >
          {loading ? (
            <div style={{ width: 16, height: 16, border: `2px solid ${C.muted}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          ) : (
            <IoRefresh size={16} color={C.blue} />
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 8px" }}>
        {rooms.length === 0 && !loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", height: "100%", justifyContent: "center" }}>
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

        {/* Leaderboard mobile: dentro do scroll, abaixo das salas.
            Em desktop fica oculto; a sidebar a direita mostra o mesmo. */}
        <Leaderboard className="lg:hidden mt-4 mb-2" />
      </div>

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
       </div>{/* fim da coluna principal */}

        {/* Sidebar leaderboard: so aparece em telas >= lg (~1024px). */}
        <aside className="hidden lg:flex lg:flex-col lg:w-80 lg:flex-shrink-0 lg:border-l lg:border-[#DDEAFF] lg:overflow-auto lg:p-4 lg:bg-white/40">
          <Leaderboard />
        </aside>
      </div>{/* fim do body wrapper responsivo */}

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
    </div>
    </PageGate>
  );
}
