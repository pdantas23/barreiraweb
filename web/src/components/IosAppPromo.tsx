// === Popup de download do app iOS (só web, só iPhone/iPad) ===
//
// Auto-contido: faz a detecção de iOS, o controle "uma vez por sessão"
// (sessionStorage — some ao fechar o browser, persiste entre navegações) e o
// delay de 1.5s. A Home só renderiza <IosAppPromo /> sem condicional.
//
// Aparece só em iOS (UA /iPhone|iPad|iPod/i) — Android/desktop não veem nada.

import { useEffect, useState } from "react";
import { IoClose, IoGameController } from "react-icons/io5";

const APP_STORE_URL = "https://apps.apple.com/app/barreira";
const SESSION_KEY = "barreira.ios_promo_shown";
const SHOW_DELAY_MS = 1_500;

// Tokens de cor do projeto (mesmos do Home/MessageModal).
const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#6E7CA1",
  white: "#FFFFFF",
  border: "#DDEAFF",
  overlay: "rgba(26, 42, 74, 0.45)",
} as const;

const isIos = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Badge oficial "Download on the App Store" como SVG inline (sem asset/dep).
const AppStoreBadge = () => (
  <svg
    viewBox="0 0 160 54"
    width="170"
    height="57"
    role="img"
    aria-label="Baixar na App Store"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1" y="1" width="158" height="52" rx="11" fill="#000000" stroke="#A6A6A6" strokeWidth="1" />
    {/* Logo da Apple */}
    <g transform="translate(14 14) scale(0.05)" fill="#FFFFFF">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </g>
    <text x="49" y="21" fill="#FFFFFF" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontSize="9">
      Baixar na
    </text>
    <text x="48" y="42" fill="#FFFFFF" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontSize="20" fontWeight="600">
      App Store
    </text>
  </svg>
);

export const IosAppPromo = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      /* sessionStorage bloqueado (modo privado etc) — trata como não-mostrado */
    }
    if (alreadyShown || !isIos()) return;

    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* ignora — pior caso reaparece numa próxima navegação */
      }
      setVisible(true);
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => setVisible(false);

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: C.overlay,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 500,
        animation: "fadeIn 200ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
          backgroundColor: C.white,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "14px 24px calc(28px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -12px 40px rgba(26, 42, 74, 0.22)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "slideUp 280ms ease-out",
        }}
      >
        {/* Grabber (estética de bottom sheet) */}
        <div
          style={{
            width: 40,
            height: 5,
            borderRadius: 3,
            backgroundColor: C.border,
            marginBottom: 18,
          }}
        />

        {/* Botão fechar (X) — canto superior direito */}
        <button
          onClick={close}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 34,
            height: 34,
            borderRadius: 17,
            border: "none",
            backgroundColor: "#EEF2FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <IoClose size={20} color={C.muted} />
        </button>

        {/* Ícone do Barreira */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 8px 20px ${C.blue}45`,
            marginBottom: 16,
          }}
        >
          <IoGameController size={38} color={C.white} />
        </div>

        {/* Título */}
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "2.1rem",
            lineHeight: 1.05,
            letterSpacing: 2,
            color: C.navy,
            textAlign: "center",
          }}
        >
          Melhor no app
        </span>

        {/* Subtítulo */}
        <span
          style={{
            color: C.muted,
            fontSize: 14,
            lineHeight: 1.45,
            textAlign: "center",
            marginTop: 6,
            marginBottom: 20,
            maxWidth: 300,
          }}
        >
          Jogue Barreira no iPhone com a experiência completa
        </span>

        {/* Badge da App Store (botão principal) */}
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          style={{ display: "inline-flex", textDecoration: "none" }}
        >
          <AppStoreBadge />
        </a>
      </div>
    </div>
  );
};
