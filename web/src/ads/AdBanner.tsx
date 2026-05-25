import { useEffect, useRef } from "react";
import { AD_CLIENT, AD_TEST_MODE } from "./adsConfig";

declare global {
  interface Window {
    adsbygoogle: Record<string, unknown>[];
  }
}

interface AdBannerProps {
  slot: string;
  format?: "auto" | "horizontal" | "vertical" | "rectangle";
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Em dev, o script do AdSense injeta `style="height: auto"` em ancestrais
// (inclusive #root), quebrando o layout. Slots fake (0000...) tambem nao
// renderizam nada util. Por isso so carregamos em producao.
const ADS_ENABLED = import.meta.env.PROD;
let scriptInjected = false;

function ensureAdSenseScript() {
  if (scriptInjected || !ADS_ENABLED || typeof document === "undefined") return;
  scriptInjected = true;
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  document.head.appendChild(s);
}

/**
 * Componente reutilizável para exibir um ad unit do Google AdSense.
 *
 * ATENÇÃO: usar SOMENTE em páginas com conteúdo editorial (/regras,
 * /estrategias, /sobre, /privacy). Nunca em /, /online, /game ou
 * /online-game — viola a política do AdSense.
 *
 * Uso:
 *   <AdBanner slot={AD_SLOTS.contentBanner} format="horizontal" className="w-full my-6" />
 */
export function AdBanner({
  slot,
  format = "auto",
  responsive = true,
  className,
  style,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !ADS_ENABLED) return;
    pushed.current = true;
    ensureAdSenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script não carregou (bloqueador de ads, etc.)
    }
  }, []);

  if (!ADS_ENABLED) {
    return (
      <div className={className} style={style}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F5F5F5",
            border: "1.5px dashed #BBBBBB",
          }}
        >
          <span style={{ fontSize: 10, color: "#BBBBBB" }}>Anuncio</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
        {...(AD_TEST_MODE ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}
