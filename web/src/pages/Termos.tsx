import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";

export default function TermosPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
      <div className="w-full flex items-center px-4 py-3 border-b border-brand/8 bg-white">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white border border-cell-bg flex items-center justify-center cursor-pointer hover:opacity-80"
        >
          <IoArrowBack size={18} color="#1A2A4A" />
        </button>
        <div className="flex-1 text-center text-lg font-extrabold text-navy">Termos de Uso</div>
        <div className="flex items-center justify-end">
          <HeaderAuthButtons />
        </div>
      </div>

      <div className="flex-1 px-5 py-6 overflow-auto">
        <div className="max-w-[640px] mx-auto bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.1)] flex flex-col gap-4 text-[14px] text-[#1A2A4A] leading-relaxed">
          <p className="text-muted text-[12px]">Ultima atualizacao: 24 de maio de 2026</p>

          <Section title="1. Aceitacao dos termos">
            Ao criar uma conta ou usar o Barreira, voce concorda com estes Termos de Uso. Se nao concorda
            com algum item, nao utilize o servico.
          </Section>

          <Section title="2. O que o servico oferece">
            O Barreira e um jogo de tabuleiro multiplayer baseado em Quoridor. Oferecemos partidas online
            contra outros jogadores ou contra bots, com identidade anonima ou via conta cadastrada.
          </Section>

          <Section title="3. Conta e responsabilidade">
            Voce e responsavel por manter a confidencialidade da sua senha. Atividades feitas com seu
            login sao consideradas suas. Avise-nos se suspeitar de uso nao autorizado.
          </Section>

          <Section title="4. Conduta esperada">
            Voce concorda em nao usar o Barreira pra atividades ilegais, abusivas ou que prejudiquem
            outros jogadores. Comportamento toxico, trapacas (uso de bots externos, manipulacao do
            cliente) ou tentativas de explorar bugs podem resultar em suspensao da conta.
          </Section>

          <Section title="5. Conteudo gerado">
            Username e mensagens trocadas em jogo (se aplicavel) sao de sua responsabilidade.
            Podemos remover usernames ofensivos a nosso criterio.
          </Section>

          <Section title="6. Disponibilidade do servico">
            Fazemos o melhor pra manter o servico no ar, mas nao garantimos disponibilidade 24/7.
            Manutencoes, falhas de infraestrutura ou atualizacoes podem causar indisponibilidade
            temporaria sem aviso previo.
          </Section>

          <Section title="7. Mudancas nos termos">
            Estes termos podem ser atualizados. Mudancas significativas serao comunicadas via email
            ou aviso no app. O uso continuado apos as mudancas significa aceitacao.
          </Section>

          <Section title="8. Encerramento de conta">
            Voce pode encerrar sua conta a qualquer momento entrando em contato pelo email de
            suporte. Reservamos o direito de encerrar contas que violem estes termos.
          </Section>

          <Section title="9. Contato">
            Em caso de duvidas ou solicitacoes, entre em contato pelo email indicado na pagina
            de suporte do app.
          </Section>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <h2 className="text-[15px] font-extrabold text-navy">{title}</h2>
    <p>{children}</p>
  </div>
);
