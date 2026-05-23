import { useEffect, useState } from "react";
import { IoEllipse, IoShuffle, IoCheckmark, IoRefresh } from "react-icons/io5";
import { theme } from "../theme";

const L = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
  red: "#FF3D6F",
};

export type ColorChoice = "cyan" | "random" | "red";

export type CreateRoomConfig = {
  color: ColorChoice;
  isPrivate: boolean;
  password: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (config: CreateRoomConfig) => void;
};

type ColorOption = {
  value: ColorChoice;
  label: string;
  accent: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
};

const COLOR_OPTIONS: ColorOption[] = [
  { value: "cyan", label: "Ciano", accent: L.blue, Icon: IoEllipse },
  { value: "random", label: "Random", accent: L.muted, Icon: IoShuffle },
  { value: "red", label: "Vermelho", accent: L.red, Icon: IoEllipse },
];

const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const CreateRoomModal = ({ visible, onClose, onConfirm }: Props) => {
  const [color, setColor] = useState<ColorChoice>("random");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (visible) {
      setColor("random");
      setIsPrivate(false);
      setPassword(generatePassword());
    }
  }, [visible]);

  const onTogglePrivate = () => {
    setIsPrivate((p) => {
      if (!p) setPassword(generatePassword());
      return !p;
    });
  };

  const onSubmit = () => {
    onConfirm({ color, isPrivate, password: isPrivate ? password : null });
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26,42,74,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 200,
        animation: "fadeIn 200ms ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          backgroundColor: L.cardBg,
          borderRadius: 20,
          padding: 22,
          border: `1px solid ${L.border}`,
          boxShadow: `0 12px 24px ${L.blue}26`,
          animation: "slideUp 340ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: L.navy, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Criar sala</div>
        <div style={{ color: L.muted, fontSize: 13, marginBottom: 18 }}>Configure sua partida online.</div>

        <div style={{ color: L.muted, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
          Sua cor
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
          {COLOR_OPTIONS.map((opt) => {
            const selected = color === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => setColor(opt.value)}
                style={{
                  flex: 1,
                  backgroundColor: selected ? `${opt.accent}14` : L.cellBg,
                  borderRadius: 14,
                  border: `2px solid ${selected ? opt.accent : L.border}`,
                  padding: "14px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    border: `1.5px solid ${opt.accent}`,
                    backgroundColor: selected ? opt.accent : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <opt.Icon size={18} color={selected ? "#0b1014" : opt.accent} />
                </div>
                <span style={{ color: L.navy, fontSize: 13, fontWeight: 700 }}>{opt.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ color: L.muted, fontSize: 11, marginTop: 10, fontStyle: "italic", textAlign: "center" }}>
          Voce sempre joga saindo de baixo do tabuleiro.
        </div>

        <div
          onClick={onTogglePrivate}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: L.cellBg,
            borderRadius: 14,
            border: `1px solid ${L.border}`,
            padding: 14,
            marginTop: 18,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${isPrivate ? L.blue : L.border}`,
              backgroundColor: isPrivate ? L.blue : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPrivate && <IoCheckmark size={16} color={L.white} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: L.navy, fontSize: 14, fontWeight: 700 }}>Sala privada</div>
            <div style={{ color: L.muted, fontSize: 11, marginTop: 2 }}>So quem tiver a senha consegue entrar</div>
          </div>
        </div>

        {isPrivate && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: L.cellBg,
              borderRadius: 12,
              border: `1px solid ${L.border}`,
              padding: 14,
              marginTop: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: L.muted, fontSize: 10, fontWeight: 800, letterSpacing: 1.5 }}>SENHA</div>
              <div style={{ color: L.blue, fontSize: 22, fontWeight: 900, letterSpacing: 4, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {password}
              </div>
            </div>
            <button
              onClick={() => setPassword(generatePassword())}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: L.white,
                border: `1px solid ${L.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <IoRefresh size={18} color={theme.textMuted} />
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 22 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "13px 0",
              borderRadius: 12,
              backgroundColor: L.white,
              border: `1px solid ${L.border}`,
              color: L.navy,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            style={{
              flex: 1.4,
              padding: "13px 0",
              borderRadius: 12,
              background: `linear-gradient(to right, ${L.blue}, ${L.blueLight})`,
              border: "none",
              color: L.white,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 0.5,
              cursor: "pointer",
            }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
};
