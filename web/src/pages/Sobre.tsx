import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { PageGate } from "../components/PageGate";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";
import { AdBanner, useAdSenseAccountMeta } from "../ads/AdBanner";
import { AD_SLOTS } from "../ads/adsConfig";

const C = {
  blue: "#3D6FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
} as const;

export default function SobreScreen() {
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
          <span style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: C.blue, letterSpacing: 3, textAlign: "center" }}>
            SOBRE
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
              padding: 24,
              border: `1px solid ${C.border}`,
              maxWidth: 760,
              margin: "0 auto",
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 900, color: C.navy, marginTop: 0, marginBottom: 6 }}>
              Sobre o Barreira
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 0, marginBottom: 20 }}>
              A história do jogo, do projeto e das pessoas por trás dele.
            </p>

            <Section title="O que é o Barreira">
              <p>
                O <strong>Barreira</strong> é um jogo de tabuleiro digital para dois jogadores, disputado em
                uma grade 9x9, inspirado no clássico <em>Quoridor</em>. A proposta é simples: em vez de
                derrotar o adversário capturando peças, você precisa atravessar o tabuleiro antes dele,
                enquanto coloca paredes para atrasar o caminho do oponente. O resultado é um jogo de
                planejamento espacial puro, sem dados, sem cartas e sem fator sorte — só você, o adversário
                e o tabuleiro.
              </p>
              <p>
                A versão web do Barreira nasceu como porta de entrada do projeto: leve, sem instalação, com
                multiplayer em tempo real e bots oferecendo três níveis de desafio. Em paralelo, mantemos
                versões para iOS e Android construídas com a mesma engine.
              </p>
            </Section>

            <Section title="A História do Quoridor">
              <p>
                O Quoridor foi criado pelo designer francês Mirko Marchesi e publicado pela Gigamic em 1997,
                a partir de um jogo anterior chamado <em>Blockade</em> dos anos 1970. Desde o lançamento,
                acumulou prêmios importantes da indústria, incluindo o <em>Mensa Mind Game</em> nos Estados
                Unidos (1997), o <em>Game of the Year</em> na França e diversos selos de qualidade na Europa.
                Hoje é considerado um clássico moderno de jogos abstratos — comparado a xadrez e dama em
                pureza estratégica, mas com regras dramaticamente mais simples de aprender.
              </p>
              <p>
                A genialidade do design está na economia: apenas dois tipos de ação (mover peão ou colocar
                parede), uma única restrição (não bloquear totalmente o caminho do oponente) e ainda assim
                uma profundidade tática quase ilimitada. Estudos computacionais já mostraram que, em
                tabuleiros pequenos (5x5 ou 7x7), o jogo pode ser resolvido por força bruta — mas no
                tabuleiro padrão 9x9, o espaço de estados é gigantesco e nenhum motor conseguiu "resolver"
                o jogo até hoje.
              </p>
            </Section>

            <Section title="Por que fizemos o Barreira">
              <p>
                Apesar da fama do Quoridor entre entusiastas, encontrar uma versão digital de qualidade,
                gratuita, sem anúncios invasivos e com multiplayer online estável sempre foi difícil. A
                maioria das implementações disponíveis ou abandona o lado online, ou oferece bots fracos, ou
                cobra por funcionalidades básicas. Decidimos construir uma alternativa pensada para o
                jogador casual que quer uma partida rápida no metrô e também para quem busca um adversário
                de bot competente para treinar.
              </p>
              <p>
                Por isso, o Barreira é gratuito, não exige cadastro, não coleta dados pessoais e usa apenas
                um identificador anônimo de sessão para reconectar você à partida em caso de queda de
                internet. As partidas online rolam em servidor próprio, com pareamento direto entre jogadores
                ou via salas privadas com senha.
              </p>
            </Section>

            <Section title="Tecnologia">
              <p>
                O Barreira é desenvolvido em TypeScript de ponta a ponta. A engine de regras (movimentos,
                validação de paredes, busca de caminhos via BFS) é compartilhada entre web e mobile, o que
                garante comportamento idêntico em todas as plataformas. O frontend web usa React + Vite, o
                mobile usa React Native via Expo, e o backend roda Node.js com Socket.io para a comunicação
                em tempo real. Toda a stack é open-source ou padrão de mercado.
              </p>
              <p>
                Os três bots — fácil, médio e difícil — são implementações distintas: o fácil usa heurística
                gulosa com aleatorização entre as top-K jogadas, o médio aplica busca de 1 nível com BFS para
                distância mais curta, e o difícil roda um minimax com poda alfa-beta de profundidade 2.
                Não usamos redes neurais nem treinamento prévio — a "inteligência" vem inteiramente da
                avaliação heurística manual.
              </p>
            </Section>

            <Section title="Privacidade e Anúncios">
              <p>
                Levamos privacidade a sério. O Barreira <strong>não exige cadastro</strong>, não coleta nome
                real, e-mail, telefone ou qualquer dado pessoal. O único identificador armazenado é uma
                string aleatória gerada no seu navegador para permitir reconexão a partidas em andamento;
                ela é descartável e não está vinculada a você de nenhuma forma. Veja nossa{" "}
                <a href="/privacy" style={{ color: C.blue, fontWeight: 700 }}>Política de Privacidade</a> para
                detalhes completos.
              </p>
              <p>
                Para manter o jogo gratuito, exibimos anúncios <strong>apenas em páginas de conteúdo</strong> (esta,
                a de Regras e a de Estratégias). Durante partidas, o jogo é livre de anúncios — entendemos
                que interromper uma partida com publicidade arruinaria a experiência.
              </p>
            </Section>

            <Section title="Créditos">
              <p>
                Design original do Quoridor: <strong>Mirko Marchesi</strong> (1997), publicado pela Gigamic.
                Implementação web do Barreira: equipe independente sem afiliação com a Gigamic. O nome
                "Barreira" e a identidade visual são originais e foram criados para diferenciar este projeto
                do produto oficial Quoridor.
              </p>
              <p>
                Trilha sonora e efeitos sonoros foram compostos especialmente para o projeto. Os ícones
                vêm da biblioteca Ionicons (licença MIT). A fonte do logotipo é Bebas Neue (SIL Open Font
                License).
              </p>
            </Section>

            <Section title="Contato">
              <p>
                Sugestões, reportes de bug, propostas de parceria ou simplesmente um "oi": escreva para{" "}
                <strong>contato@barreira.app</strong>. Lemos todas as mensagens.
              </p>
            </Section>

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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 22 }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>{title}</h2>
    <div style={{ fontSize: 13.5, color: "#4A5C7A", lineHeight: 1.7 }}>{children}</div>
  </div>
);
