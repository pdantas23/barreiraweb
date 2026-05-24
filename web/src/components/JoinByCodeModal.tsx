import { useEffect, useState } from "react";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (code: string, password: string) => void;
  initialCode?: string;
  requirePassword?: boolean;
  codeLocked?: boolean;
};

const CODE_LENGTH = 6;
const PASSWORD_LENGTH = 6;

const L = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  textSecondary: "#5C6F8F",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
  red: "#FF3D6F",
};

const normalize = (raw: string, max: number) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

export const JoinByCodeModal = ({
  visible,
  onClose,
  onConfirm,
  initialCode = "",
  requirePassword = false,
  codeLocked = false,
}: Props) => {
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (visible) {
      setCode(initialCode);
      setPassword("");
    }
  }, [visible, initialCode]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  const onChangeCode = (raw: string) => {
    if (codeLocked) return;
    setCode(normalize(raw, CODE_LENGTH));
  };

  const onChangePassword = (raw: string) => {
    setPassword(normalize(raw, PASSWORD_LENGTH));
  };

  const canSubmit = code.length === CODE_LENGTH && (!requirePassword || password.length > 0);

  if (!visible) return null;

  const inputBase: React.CSSProperties = {
    width: "100%",
    color: L.navy,
    backgroundColor: L.cellBg,
    border: `1px solid ${L.border}`,
    borderRadius: 14,
    padding: "16px 18px",
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: 8,
    textAlign: "center",
    textTransform: "uppercase",
    fontVariantNumeric: "tabular-nums",
    outline: "none",
    boxSizing: "border-box",
  };

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
          maxWidth: 380,
          backgroundColor: L.cardBg,
          borderRadius: 20,
          padding: 22,
          border: `1px solid ${L.border}`,
          boxShadow: `0 12px 24px ${L.blue}26`,
          animation: "slideUp 340ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: L.navy, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          {requirePassword ? "Sala privada" : "Entrar com codigo"}
        </div>
        <div style={{ color: L.textSecondary, fontSize: 13, marginBottom: 18 }}>
          {requirePassword
            ? "Digite a senha para entrar nessa sala."
            : `Digite o codigo de ${CODE_LENGTH} caracteres da sala.`}
        </div>

        <input
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          autoFocus={!codeLocked}
          maxLength={CODE_LENGTH}
          placeholder="ABCD12"
          readOnly={codeLocked}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          style={{
            ...inputBase,
            opacity: codeLocked ? 0.85 : 1,
            cursor: codeLocked ? "default" : "text",
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
                backgroundColor: i < code.length ? L.blue : L.border,
                transition: "background-color 150ms",
              }}
            />
          ))}
        </div>

        {requirePassword && (
          <input
            value={password}
            onChange={(e) => onChangePassword(e.target.value)}
            autoFocus={codeLocked}
            maxLength={PASSWORD_LENGTH}
            placeholder="SENHA"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            style={{ ...inputBase, marginTop: 16 }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 20 }}>
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
            onClick={() => canSubmit && onConfirm(code, password)}
            disabled={!canSubmit}
            style={{
              flex: 1.4,
              padding: "13px 0",
              borderRadius: 12,
              background: canSubmit ? `linear-gradient(to right, ${L.blue}, ${L.blueLight})` : L.cellBg,
              border: "none",
              color: canSubmit ? L.white : L.muted,
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
