import type { ReactNode } from "react";
import { IoAlertCircle, IoFlagOutline, IoHelpCircleOutline } from "react-icons/io5";

type Variant = "warning" | "danger" | "info";

type Props = {
  visible: boolean;
  variant?: Variant;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  icon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

const PALETTE = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  textSecondary: "#5C6F8F",
  white: "#FFFFFF",
  border: "#DDEAFF",
  red: "#FF3D6F",
  amber: "#FFB13D",
} as const;

const variantStyle = (v: Variant) => {
  if (v === "danger") return { accent: PALETTE.red, Icon: IoAlertCircle };
  if (v === "info") return { accent: PALETTE.blue, Icon: IoHelpCircleOutline };
  return { accent: PALETTE.amber, Icon: IoFlagOutline };
};

export const ConfirmModal = ({
  visible,
  variant = "warning",
  title,
  message,
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  icon,
  onCancel,
  onConfirm,
}: Props) => {
  if (!visible) return null;

  const { accent, Icon } = variantStyle(variant);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 42, 74, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 350,
        animation: "fadeIn 150ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          backgroundColor: PALETTE.white,
          borderRadius: 20,
          padding: "28px 22px",
          border: `1px solid ${PALETTE.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 12px 24px rgba(26,42,74,0.2)",
          animation: "slideUp 300ms ease-out",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            border: `2px solid ${accent}`,
            backgroundColor: `${accent}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {icon ?? <Icon size={36} color={accent} />}
        </div>

        <span style={{ fontSize: 20, fontWeight: 900, color: PALETTE.navy, marginBottom: 8, textAlign: "center" }}>
          {title}
        </span>
        <span
          style={{
            color: PALETTE.textSecondary,
            fontSize: 13,
            textAlign: "center",
            marginBottom: 22,
            padding: "0 8px",
            lineHeight: 1.45,
          }}
        >
          {message}
        </span>

        <div style={{ display: "flex", flexDirection: "row", gap: 10, width: "100%" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "13px 0",
              borderRadius: 12,
              backgroundColor: PALETTE.white,
              border: `1px solid ${PALETTE.border}`,
              color: PALETTE.navy,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "13px 0",
              borderRadius: 12,
              backgroundColor: accent,
              border: "none",
              color: PALETTE.white,
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
