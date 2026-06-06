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

// Em dev, o script real do AdSense injeta `style="height: auto"` em ancestrais
// (inclusive #root), quebrando o layout, e slots fake não rendem nada útil.
// Por isso só carrega em produção.
const ADS_ENABLED = import.meta.env.PROD;

// ─── Carregamento reference-counted do script ───
// O script do AdSense só fica no DOM enquanto há ao menos um <AdBanner> montado.
// Ao sair de TODAS as páginas de conteúdo (lobby, jogo, matchmaking, etc.) o
// contador zera e o script é REMOVIDO. Sem isso ele era injetado uma vez e
// vazava pra todas as rotas da SPA — violação ("anúncios em telas sem conteúdo").
let mountedBanners = 0;
let scriptEl: HTMLScriptElement | null = null;

function addAdSenseScript(): void {
  if (!ADS_ENABLED || typeof document === "undefined") return;
  mountedBanners += 1;
  if (scriptEl) return; // já presente
  scriptEl = document.createElement("script");
  scriptEl.async = true;
  scriptEl.crossOrigin = "anonymous";
  scriptEl.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  scriptEl.dataset.adsbygoogle = "barreira";
  document.head.appendChild(scriptEl);
}

function removeAdSenseScript(): void {
  if (!ADS_ENABLED || typeof document === "undefined") return;
  mountedBanners = Math.max(0, mountedBanners - 1);
  if (mountedBanners > 0 || !scriptEl) return; // ainda há banner montado
  scriptEl.remove();
  scriptEl = null;
  // Zera a fila global pra não vazar estado pra outras rotas.
  try {
    delete (window as { adsbygoogle?: unknown }).adsbygoogle;
  } catch {
    (window as { adsbygoogle?: unknown }).adsbygoogle = undefined;
  }
}

/**
 * Meta tag de verificação da conta AdSense (`google-adsense-account`).
 * Usar SOMENTE nas páginas de conteúdo (/regras, /estrategias, /sobre,
 * /privacy): adiciona no mount, remove no unmount — não vaza pra outras rotas.
 */
export function useAdSenseAccountMeta(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector('meta[name="google-adsense-account"]')) return; // já existe
    const m = document.createElement("meta");
    m.name = "google-adsense-account";
    m.content = AD_CLIENT;
    m.dataset.dynamic = "adsense";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
}

/**
 * Ad unit do Google AdSense.
 *
 * ATENÇÃO: usar SOMENTE em páginas com conteúdo editorial (/regras,
 * /estrategias, /sobre, /privacy). NUNCA em /, /online, /game ou /online-game
 * — viola a política do AdSense. O script é carregado no mount e removido no
 * unmount (reference-counted), então não persiste ao navegar pra outras rotas.
 */
export function AdBanner({
  slot,
  format = "auto",
  responsive = true,
  className,
  style,
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    addAdSenseScript();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script não carregou (bloqueador de ads, etc.)
    }
    return () => removeAdSenseScript();
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
