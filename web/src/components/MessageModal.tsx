import { IoAlertCircle, IoCheckmarkCircle, IoInformationCircle } from "react-icons/io5";

type Variant = "info" | "error" | "success";

type Props = {
  visible: boolean;
  variant?: Variant;
  title?: string;
  message: string;
  okLabel?: string;
  onClose: () => void;
};

const PALETTE = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  muted: "#6E7CA1",
  white: "#FFFFFF",
  cardBorder: "#DDEAFF",
  red: "#E04256",
  green: "#16A37C",
} as const;

const variantStyle = (v: Variant) => {
  if (v === "error") return { color: PALETTE.red, Icon: IoAlertCircle };
  if (v === "success") return { color: PALETTE.green, Icon: IoCheckmarkCircle };
  return { color: PALETTE.blue, Icon: IoInformationCircle };
};

export const MessageModal = ({ visible, variant = "info", title, message, okLabel = "OK", onClose }: Props) => {
  if (!visible) return null;

  const { color, Icon } = variantStyle(variant);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 42, 74, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 400,
        animation: "fadeIn 160ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          backgroundColor: PALETTE.white,
          borderRadius: 20,
          padding: "24px 22px 18px",
          border: `1px solid ${PALETTE.cardBorder}`,
          boxShadow: "0 16px 40px rgba(26, 42, 74, 0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "slideUp 220ms ease-out",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Icon size={30} color={color} />
        </div>

        {title && (
          <div style={{ color: PALETTE.navy, fontSize: 17, fontWeight: 800, marginBottom: 6, textAlign: "center" }}>
            {title}
          </div>
        )}
        <div style={{ color: PALETTE.muted, fontSize: 14, lineHeight: 1.45, textAlign: "center", marginBottom: 18, padding: "0 4px" }}>
          {message}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: 12,
            background: `linear-gradient(to right, ${PALETTE.blue}, #6B9FFF)`,
            border: "none",
            color: PALETTE.white,
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow: `0 6px 16px ${PALETTE.blue}40`,
          }}
        >
          {okLabel}
        </button>
      </div>
    </div>
  );
};
