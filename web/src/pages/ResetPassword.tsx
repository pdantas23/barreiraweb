import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack, IoLockClosed, IoCheckmarkCircle } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { supabase } from "../net/supabase";
import { playButtonSound } from "../hooks/useButtonSound";

// Fluxo: o usuário clicou no link enviado pelo Supabase (resetPasswordForEmail).
// O Supabase redireciona pra /reset-password com tokens no hash da URL.
// O SDK detecta automaticamente e cria uma sessão temporária — daí
// chamamos updateUser({ password }) pra trocar a senha.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Espera o SDK processar o hash (PASSWORD_RECOVERY event) ou checa
  // a sessão atual. Se chegou aqui sem token, o link era inválido/expirado.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !hasSession)) {
        setHasSession(true);
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [hasSession]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    playButtonSound();
    setDone(true);
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
      <Header onBack={() => navigate("/login")} title="Nova senha" />

      <div className="flex-1 flex items-start justify-center px-5 pt-8 pb-12">
        {!ready ? (
          <div className="text-[13px] text-muted">Carregando...</div>
        ) : done ? (
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4 items-center text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <IoCheckmarkCircle size={32} color="#10b981" />
            </div>
            <h2 className="text-[16px] font-extrabold text-navy">Senha alterada</h2>
            <p className="text-[13px] text-muted">Pronto. Sua nova senha já está ativa.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
            >
              Ir pro início
            </button>
          </div>
        ) : !hasSession ? (
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4 items-center text-center">
            <h2 className="text-[16px] font-extrabold text-navy">Link inválido</h2>
            <p className="text-[13px] text-muted">
              O link de recuperação expirou ou já foi usado. Solicite um novo na tela de login.
            </p>
            <button
              onClick={() => navigate("/esqueci-senha")}
              className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
            >
              Solicitar novo link
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4"
          >
            <p className="text-[13px] text-muted">
              Escolha uma nova senha pra sua conta. Mínimo de 6 caracteres.
            </p>

            <Field
              label="Nova senha"
              value={password}
              onChange={setPassword}
              minLength={6}
              autoComplete="new-password"
            />
            <Field
              label="Confirmar senha"
              value={confirm}
              onChange={setConfirm}
              minLength={6}
              autoComplete="new-password"
            />

            {error && (
              <div className="text-[13px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const Header = ({ onBack, title }: { onBack: () => void; title: string }) => (
  <div className="w-full flex items-center px-4 py-3 border-b border-brand/8 bg-white">
    <button
      onClick={onBack}
      className="w-9 h-9 rounded-full bg-white border border-cell-bg flex items-center justify-center cursor-pointer hover:opacity-80"
    >
      <IoArrowBack size={18} color="#1A2A4A" />
    </button>
    <div className="flex-1 text-center text-lg font-extrabold text-navy">{title}</div>
    <div className="w-9" />
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  minLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
  autoComplete?: string;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12px] font-semibold text-navy tracking-wide">{label}</span>
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-cell-bg bg-white focus-within:border-brand transition-colors">
      <IoLockClosed size={18} color="#9AAACA" />
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        className="flex-1 bg-transparent border-none outline-none text-[14px] text-navy"
      />
    </div>
  </label>
);
