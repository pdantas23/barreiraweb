import { useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";

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

  return (
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
          Politica de Privacidade
        </span>
        <div style={{ width: 40 }} />
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
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Ultima atualizacao: 22 de maio de 2025</div>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>1. Introducao</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            O Barreira ("nos", "nosso") e um jogo de tabuleiro multiplayer. Esta politica descreve como tratamos informacoes quando voce usa nosso aplicativo.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>2. Dados que coletamos</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            • Identificador de sessao: geramos um ID aleatorio por instalacao para permitir reconexao durante partidas online. Este ID nao esta vinculado a sua identidade real.
            <br /><br />
            • Nome de exibicao: o nome mostrado aos oponentes durante partidas online (padrao: "Jogador"). Nao e persistido em nossos servidores apos o fim da partida.
            <br /><br />
            • Dados de conexao: endereco IP e metadados tecnicos do WebSocket sao processados em tempo real para manter a partida, mas nao sao armazenados permanentemente.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>3. Como usamos os dados</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Os dados sao usados exclusivamente para:
            <br /><br />
            • Estabelecer e manter conexoes de partida em tempo real<br />
            • Permitir reconexao em caso de perda temporaria de rede<br />
            • Exibir nomes dos jogadores durante a partida
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>4. Compartilhamento de dados</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Nao vendemos, compartilhamos ou transferimos seus dados para terceiros. Nao utilizamos servicos de analytics ou publicidade.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>5. Armazenamento</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Nao mantemos banco de dados de usuarios. Os dados de sessao existem apenas na memoria do servidor durante partidas ativas e sao descartados quando a partida termina ou o servidor reinicia.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>6. Seus direitos</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Como nao armazenamos dados pessoais permanentes, nao ha dados para solicitar exclusao. O identificador de sessao e regenerado ao reinstalar o aplicativo.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>7. Criancas</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            O Barreira nao coleta intencionalmente dados de criancas menores de 13 anos. O app nao requer cadastro nem dados pessoais.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>8. Alteracoes</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Podemos atualizar esta politica. Alteracoes significativas serao comunicadas atraves de atualizacao do app.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginTop: 18, marginBottom: 8 }}>9. Contato</h3>
          <p style={{ fontSize: 13, color: "#4A5C7A", lineHeight: 1.6 }}>
            Em caso de duvidas sobre privacidade, entre em contato pelo email: contato@barreira.app
          </p>
        </div>
      </div>
    </div>
  );
}
