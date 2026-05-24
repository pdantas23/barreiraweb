import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { AD_CLIENT, AD_TEST_MODE } from "./adsConfig";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdInterstitialProps {
  visible: boolean;
  slot: string;
  /** Segundos antes de liberar o botão de fechar */
  closeDelay?: number;
  onClose: () => void;
}

/**
 * Interstitial fullscreen com ad do AdSense.
 * Exibe um countdown e só libera o X após o tempo.
 *
 * TODO: quando migrar para AdMob SDK nativo, este componente
 * será substituído pela chamada do SDK — o AdMob controla
 * o botão de fechar nativamente.
 */
export function AdInterstitial({
  visible,
  slot,
  closeDelay = 5,
  onClose,
}: AdInterstitialProps) {
  const [countdown, setCountdown] = useState(closeDelay);
  const [canClose, setCanClose] = useState(false);
  const pushed = useRef(false);

  // Reset estado quando abre
  useEffect(() => {
    if (!visible) {
      pushed.current = false;
      return;
    }
    setCountdown(closeDelay);
    setCanClose(false);
  }, [visible, closeDelay]);

  // Push ad quando visível
  useEffect(() => {
    if (!visible || pushed.current) return;
    if (!import.meta.env.PROD) return;
    pushed.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script não carregou
    }
  }, [visible]);

  // Timer countdown
  useEffect(() => {
    if (!visible || canClose) return;
    if (countdown <= 0) {
      setCanClose(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [visible, canClose, countdown]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(26, 42, 74, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 250,
      }}
    >
      {/* Botão fechar / countdown */}
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        {canClose ? (
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.9)",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <IoClose size={20} color="#1A2A4A" />
          </button>
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.5)",
              fontSize: 13,
              fontWeight: 700,
              color: "#1A2A4A",
            }}
          >
            {countdown}
          </div>
        )}
      </div>

      {/* Ad unit — 300x250 Medium Rectangle centralizado */}
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: 300, height: 250 }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format="rectangle"
        data-full-width-responsive="false"
        {...(AD_TEST_MODE ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}
