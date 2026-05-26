// === Tela de Perfil ===
//
// Mostra avatar (inicial do username), username, email, trofeus_casual e
// botao de sair. Acessivel em /perfil.
//
// Se o user nao esta logado, redireciona pra /login (a tela so faz sentido
// pra quem ja tem conta).

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoChevronBack, IoLogOutOutline, IoMailOutline, IoPersonCircle, IoTrophy } from "react-icons/io5";
import { PageGate } from "../components/PageGate";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  gold: "#F4B619",
} as const;

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, username, trofeusCasual, signOut, loading } = useAuth();

  // Redireciona anonimos. Aguarda o loading inicial pra nao mandar pra
  // login antes da sessao persistida ser lida do localStorage.
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  const onSignOut = async () => {
    playButtonSound();
    await signOut();
    navigate("/", { replace: true });
  };

  const initial = (username ?? user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <PageGate ready={!loading}>
      <div
        style={{
          height: "100%",
          background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "10px 16px" }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}
          >
            <IoChevronBack size={28} color={C.navy} />
          </button>
          <span style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: C.blue, letterSpacing: 3, textAlign: "center" }}>
            PERFIL
          </span>
          <div style={{ minWidth: 40 }} />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px" }}>
          {/* Avatar + identidade */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 24px" }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 48,
                letterSpacing: 1,
                boxShadow: `0 6px 18px ${C.blue}33`,
                marginBottom: 12,
              }}
            >
              {initial}
            </div>
            <span style={{ color: C.navy, fontSize: 22, fontWeight: 800 }}>{username ?? "—"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 12, marginTop: 4 }}>
              <IoMailOutline size={13} />
              {user?.email ?? ""}
            </span>
          </div>

          {/* Card de troféus */}
          <div
            style={{
              backgroundColor: C.cardBg,
              borderRadius: 16,
              padding: 20,
              border: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "#FFF6D6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IoTrophy size={28} color={C.gold} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                Troféus Casual
              </span>
              <span style={{ color: C.navy, fontSize: 28, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                {trofeusCasual ?? 0}
              </span>
              <span style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                +1 por vitória em partida online
              </span>
            </div>
          </div>

          {/* Placeholder pra estatísticas futuras */}
          <div
            style={{
              backgroundColor: C.cardBg,
              borderRadius: 16,
              padding: 16,
              border: `1px dashed ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
              opacity: 0.7,
            }}
          >
            <IoPersonCircle size={28} color={C.muted} />
            <span style={{ color: C.muted, fontSize: 12 }}>
              Mais estatísticas em breve (partidas, vitórias, ranking).
            </span>
          </div>

          <button
            onClick={onSignOut}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px",
              borderRadius: 12,
              backgroundColor: "#EEF2FF",
              border: "none",
              color: C.navy,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <IoLogOutOutline size={18} />
            Sair da conta
          </button>
        </div>
      </div>
    </PageGate>
  );
}
