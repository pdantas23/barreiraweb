import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { PageGate } from "../components/PageGate";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";
import { AdBanner, useAdSenseAccountMeta } from "../ads/AdBanner";
import { AD_SLOTS } from "../ads/adsConfig";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
} as const;

export default function PrivacyScreen() {
  const navigate = useNavigate();
  useAdSenseAccountMeta(); // meta da conta AdSense só nas páginas de conteúdo

  return (
    <PageGate>
    <div
      style={{
        height: "100%",
        background: `linear-gradient(to bottom, ${C.bgTop}, ${C.bgBottom})`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "10px 16px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}
        >
          <IoChevronBack size={28} color={C.navy} />
        </button>
        <span style={{ flex: 1, color: C.navy, fontSize: 16, fontWeight: 800, letterSpacing: 0.5, textAlign: "center" }}>
          Política de Privacidade
        </span>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", minWidth: 40 }}>
          <HeaderAuthButtons />
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px" }}>
        <div
          style={{
            backgroundColor: C.cardBg,
            borderRadius: 16,
            padding: 20,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Última atualização: 22 de maio de 2025</div>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>1. Introdução</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            O Barreira ("nós", "nosso") é um jogo de tabuleiro multiplayer. Esta política descreve como tratamos informações quando você usa nosso aplicativo.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>2. Dados que coletamos</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            • Identificador de sessão: geramos um ID aleatório por instalação para permitir reconexão durante partidas online. Este ID não está vinculado à sua identidade real.
            <br /><br />
            • Nome de exibição: o nome mostrado aos oponentes durante partidas online (padrão: "Jogador"). Não é persistido em nossos servidores após o fim da partida.
            <br /><br />
            • Dados de conexão: endereço IP e metadados técnicos do WebSocket são processados em tempo real para manter a partida, mas não são armazenados permanentemente.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>3. Como usamos os dados</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Os dados são usados exclusivamente para:
            <br /><br />
            • Estabelecer e manter conexões de partida em tempo real<br />
            • Permitir reconexão em caso de perda temporária de rede<br />
            • Exibir nomes dos jogadores durante a partida
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>4. Compartilhamento de dados e anúncios</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Não vendemos seus dados pessoais. No site (versão web), exibimos anúncios do <strong>Google AdSense</strong> apenas nas páginas de conteúdo (Regras, Estratégias, Sobre e esta página). O Google e seus parceiros podem usar cookies para veicular e personalizar anúncios; você pode gerenciar suas preferências em <a href="https://www.google.com/settings/ads" style={{ color: C.blue, fontWeight: 700 }}>google.com/settings/ads</a>. Durante as partidas o jogo é <strong>livre de anúncios</strong> e não há rastreamento de terceiros nessas telas.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>5. Armazenamento</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Não mantemos banco de dados de usuários. Os dados de sessão existem apenas na memória do servidor durante partidas ativas e são descartados quando a partida termina ou o servidor reinicia.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>6. Seus direitos</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Como não armazenamos dados pessoais permanentes, não há dados para solicitar exclusão. O identificador de sessão é regenerado ao reinstalar o aplicativo.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>7. Crianças</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            O Barreira não coleta intencionalmente dados de crianças menores de 13 anos. O app não requer cadastro nem dados pessoais.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>8. Alterações</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Podemos atualizar esta política. Alterações significativas serão comunicadas através de atualização do app.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>9. Contato</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Em caso de dúvidas sobre privacidade, entre em contato pelo email: contato@barreira.app
          </p>

          <AdBanner
            slot={AD_SLOTS.contentBanner}
            format="horizontal"
            className="w-full my-6"
            style={{ minHeight: 90 }}
          />
        </div>
      </div>
    </div>
    </PageGate>
  );
}
