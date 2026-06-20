// === Países pro Replay Builder (skins de bandeira) ===
//
// As bandeiras vêm do projeto circle-flags (hatscripts.github.io): SVGs das
// bandeiras REAIS já recortadas em círculo — encaixam direto no peão redondo.
// GitHub Pages serve com `Access-Control-Allow-Origin: *`, então dá pra
// desenhar no canvas de gravação com crossOrigin="anonymous" sem "tainted
// canvas" (que mataria o captureStream do vídeo).
//
// `wallColor` é a cor icônica da bandeira usada nas barreiras do jogador
// (ex.: Brasil = verde). Dev-only — depende de internet, como o resto do builder.

export type CountryOption = {
  code: string; // ISO 3166-1 alpha-2, minúsculo (vai na URL da bandeira)
  name: string;
  wallColor: string;
};

export const flagUrl = (code: string): string =>
  `https://hatscripts.github.io/circle-flags/flags/${code}.svg`;

export const COUNTRIES: CountryOption[] = [
  { code: "br", name: "Brasil", wallColor: "#009C3B" },
  { code: "ar", name: "Argentina", wallColor: "#74ACDF" },
  { code: "uy", name: "Uruguai", wallColor: "#5CB8E4" },
  { code: "py", name: "Paraguai", wallColor: "#D52B1E" },
  { code: "cl", name: "Chile", wallColor: "#D52B1E" },
  { code: "pe", name: "Peru", wallColor: "#D91023" },
  { code: "co", name: "Colômbia", wallColor: "#FCD116" },
  { code: "ve", name: "Venezuela", wallColor: "#FFCC00" },
  { code: "mx", name: "México", wallColor: "#006341" },
  { code: "us", name: "Estados Unidos", wallColor: "#B22234" },
  { code: "ca", name: "Canadá", wallColor: "#FF0000" },
  { code: "pt", name: "Portugal", wallColor: "#DA291C" },
  { code: "es", name: "Espanha", wallColor: "#AA151B" },
  { code: "fr", name: "França", wallColor: "#0055A4" },
  { code: "de", name: "Alemanha", wallColor: "#FFCC00" },
  { code: "it", name: "Itália", wallColor: "#008C45" },
  { code: "gb", name: "Reino Unido", wallColor: "#C8102E" },
  { code: "nl", name: "Holanda", wallColor: "#FF6C00" },
  { code: "jp", name: "Japão", wallColor: "#BC002D" },
  { code: "kr", name: "Coreia do Sul", wallColor: "#0047A0" },
  { code: "cn", name: "China", wallColor: "#DE2910" },
  { code: "in", name: "Índia", wallColor: "#FF9933" },
  { code: "au", name: "Austrália", wallColor: "#012169" },
  { code: "ng", name: "Nigéria", wallColor: "#008751" },
  { code: "eg", name: "Egito", wallColor: "#C8102E" },
  { code: "ru", name: "Rússia", wallColor: "#0039A6" },
];

export const countryByCode = (code: string): CountryOption | undefined =>
  COUNTRIES.find((c) => c.code === code);
