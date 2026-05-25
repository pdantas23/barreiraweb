import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import { PageGate } from "../components/PageGate";
import { AdBanner } from "../ads/AdBanner";
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

export default function RegrasScreen() {
  const navigate = useNavigate();

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
            REGRAS
          </span>
          <div style={{ width: 40 }} />
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
              Regras Completas do Barreira
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 0, marginBottom: 20 }}>
              Guia oficial das regras do Barreira, jogo de tabuleiro estratégico inspirado no clássico Quoridor.
            </p>

            <Section title="Objetivo do Jogo">
              <p>
                O Barreira é um jogo para dois jogadores disputado em um tabuleiro 9x9. O objetivo é simples de
                entender e desafiador de executar: ser o primeiro jogador a mover seu peão até a linha oposta
                do tabuleiro, ou seja, qualquer casa da fileira inicial do adversário. Quem cruzar primeiro
                vence a partida. Apesar de o objetivo parecer trivial, cada jogador tem à disposição um conjunto
                de paredes que podem ser usadas para atrasar, redirecionar ou prender momentaneamente o
                oponente — o que transforma o jogo em um duelo de planejamento espacial.
              </p>
            </Section>

            <Section title="O Tabuleiro">
              <p>
                O tabuleiro tem 81 casas dispostas em uma grade de 9 colunas por 9 linhas. As fileiras de
                início ficam nas extremidades superior e inferior; cada peão começa centralizado na sua linha
                inicial, ou seja, na quinta coluna. As intersecções entre as casas — não as casas em si — são
                onde as paredes são encaixadas. Existem 8x8 = 64 intersecções internas, e cada parede ocupa
                duas intersecções consecutivas (horizontais ou verticais).
              </p>
            </Section>

            <Section title="Turnos">
              <p>
                Os jogadores alternam turnos. Em cada turno, você deve escolher exatamente <strong>uma</strong> de
                duas ações possíveis: <strong>mover o seu peão</strong> uma casa, ou <strong>colocar uma parede</strong> em
                qualquer intersecção do tabuleiro. Não é permitido passar a vez, nem combinar as duas ações no
                mesmo turno. Essa restrição binária é o coração da tensão estratégica do jogo: cada parede
                colocada é um movimento que você não fez em direção à vitória, e vice-versa.
              </p>
            </Section>

            <Section title="Movimento do Peão">
              <p>
                O peão se move uma casa por turno, em qualquer direção <strong>ortogonal</strong> (cima, baixo,
                esquerda ou direita). Movimentos diagonais simples não são permitidos. Se houver uma parede
                entre a casa atual e a casa de destino, esse movimento fica bloqueado. Quando o peão adversário
                ocupa a casa imediatamente adjacente à sua, surge uma regra especial: você pode <strong>pular por
                cima</strong> do adversário, indo direto para a casa seguinte na mesma direção, desde que essa
                casa exista e não esteja bloqueada por uma parede.
              </p>
              <p>
                Quando o salto reto está bloqueado — porque há uma parede atrás do adversário ou porque a
                casa de destino estaria fora do tabuleiro — o salto se desdobra em duas opções <strong>diagonais</strong>:
                você pode contornar o adversário indo para uma das duas casas perpendiculares ao seu
                movimento, desde que essas casas não estejam bloqueadas por paredes. Essa é a regra oficial do
                Quoridor e está implementada fielmente no Barreira.
              </p>
            </Section>

            <Section title="Paredes">
              <p>
                Cada jogador recebe 10 paredes no início da partida. Cada parede tem o comprimento de duas
                casas e pode ser posicionada na horizontal ou na vertical, sempre encaixada em uma
                intersecção. Uma parede colocada bloqueia a passagem entre as casas que ela cobre, tanto para
                o seu peão quanto para o do adversário. As paredes são <strong>permanentes</strong>: uma vez
                colocadas, ninguém pode movê-las ou removê-las pelo resto da partida.
              </p>
              <p>
                Duas paredes não podem se sobrepor parcialmente nem cruzar uma à outra. A interface do
                Barreira mostra um pré-visualização em azul-fantasma sempre que o encaixe é válido; quando
                a posição é inválida (sobreposição, cruzamento ou bloqueio total), nada é exibido e a
                tentativa é descartada ao soltar.
              </p>
            </Section>

            <Section title="Restrição do Caminho">
              <p>
                Existe uma única — e absolutamente essencial — restrição para o posicionamento de paredes:
                você <strong>nunca pode</strong> colocar uma parede que feche completamente o caminho de qualquer
                jogador até o seu objetivo. Em outras palavras, mesmo depois da sua jogada, deve sempre
                existir pelo menos uma rota possível para o seu peão chegar na sua linha-alvo, e o mesmo
                vale para o peão adversário. O servidor faz uma busca em largura (BFS) a cada tentativa de
                posicionamento para garantir essa propriedade. Se a parede bloqueia algum dos dois caminhos,
                ela é rejeitada antes de ser colocada.
              </p>
            </Section>

            <Section title="Controle de Tempo">
              <p>
                As partidas online no Barreira usam um relógio individual de 3 minutos por jogador, no modelo
                Fischer. Seu cronômetro só roda quando é o seu turno; ele pausa assim que você joga. Se o seu
                tempo zerar, você perde a partida imediatamente, independentemente da posição no tabuleiro.
                Esse controle de tempo evita partidas eternas e força decisões rápidas em momentos críticos.
              </p>
            </Section>

            <Section title="Condições de Vitória e Derrota">
              <p>
                Você vence quando seu peão alcança qualquer casa da linha inicial do adversário — para o
                jogador que começa embaixo, isso significa chegar na fileira do topo, e vice-versa. Também é
                possível vencer por <strong>tempo</strong> (se o adversário deixar o relógio zerar) ou por
                <strong> desistência</strong> (W.O.), quando o adversário fecha a janela ou se desconecta e não
                retorna dentro do prazo de reconexão. Empates não existem no Barreira: por construção das
                regras e da restrição de caminho, sempre há um vencedor.
              </p>
            </Section>

            <AdBanner
              slot={AD_SLOTS.contentBanner}
              format="horizontal"
              className="w-full my-6"
              style={{ minHeight: 90 }}
            />

            <Section title="Modos de Jogo">
              <p>
                O Barreira oferece dois modos principais. No <strong>Treino</strong>, você joga offline contra a
                CPU em três níveis de dificuldade: fácil (que sorteia entre as 6 melhores jogadas avaliadas
                por uma heurística simples), médio (que aplica busca gulosa de 1 nível com BFS para distância
                mais curta) e difícil (que roda um minimax com poda alfa-beta de profundidade 2). No modo
                <strong> Casual</strong>, você cria ou entra em uma sala online e enfrenta outro jogador humano
                em tempo real. As salas podem ser públicas (qualquer um entra) ou privadas (com senha), e o
                sistema garante reconexão automática em caso de queda temporária de internet.
              </p>
            </Section>
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
