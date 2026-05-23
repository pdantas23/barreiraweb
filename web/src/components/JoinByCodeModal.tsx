import { useEffect, useState } from "react";
import { theme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
};

const CODE_LENGTH = 6;

export const JoinByCodeModal = ({ visible, onClose, onConfirm }: Props) => {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (visible) setCode("");
  }, [visible]);

  const onChange = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
    setCode(cleaned);
  };

  const canSubmit = code.length === CODE_LENGTH;

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
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
          maxWidth: 380,
          backgroundColor: theme.boardBg,
          borderRadius: 20,
          padding: 22,
          border: "1px solid #2a2a35",
          boxShadow: "0 12px 24px rgba(0,0,0,0.5)",
          animation: "slideUp 340ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: theme.textPrimary, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          Entrar com codigo
        </div>
        <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 18 }}>
          Digite o codigo de {CODE_LENGTH} caracteres da sala.
        </div>

        <input
          value={code}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          maxLength={CODE_LENGTH}
          placeholder="ABCD12"
          style={{
            width: "100%",
            color: theme.textPrimary,
            backgroundColor: "#1f1f27",
            border: "1px solid #2a2a35",
            borderRadius: 14,
            padding: "16px 18px",
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 8,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i < code.length ? theme.player1 : "#2a2a35",
                transition: "background-color 150ms",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "13px 0",
              borderRadius: 12,
              backgroundColor: "transparent",
              border: "1px solid #3a3a48",
              color: theme.textMuted,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => canSubmit && onConfirm(code)}
            disabled={!canSubmit}
            style={{
              flex: 1.4,
              padding: "13px 0",
              borderRadius: 12,
              backgroundColor: canSubmit ? theme.player1 : "#2a2a35",
              border: "none",
              color: "#0b1014",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 0.5,
              cursor: canSubmit ? "pointer" : "default",
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
};
