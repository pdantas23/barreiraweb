import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IoArrowBack, IoMail, IoLockClosed, IoPerson } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";
import { redirectToAppIfFromApp, withAppParams } from "../net/deepLink";
import { supabase } from "../net/supabase";

export default function CadastroPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validacao local antes de bater no Supabase
    if (username.trim().length < 3) {
      setError("Username precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (username.trim().length > 20) {
      setError("Username pode ter no maximo 20 caracteres.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      setError("Username so pode ter letras, numeros, _ e -.");
      return;
    }
    if (password.length < 6) {
      setError("Senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("As senhas nao conferem.");
      return;
    }
    if (!accepted) {
      setError("Voce precisa aceitar os termos e a politica de privacidade.");
      return;
    }

    setSubmitting(true);
    const result = await signUp({
      username: username.trim(),
      email: email.trim(),
      password,
      acceptedTerms: accepted,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Se cadastro já cria sessão (confirmação de email DESABILITADA no
    // Supabase) e o usuário veio do app, redireciona direto pro deep link.
    // Se confirmação tá habilitada, getSession() retorna null e a tela de
    // sucesso aparece pedindo pra confirmar email.
    const { data } = await supabase.auth.getSession();
    if (redirectToAppIfFromApp(data.session)) return;

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
        <Header onBack={() => navigate("/")} title="Conta criada" />
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-6 text-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]">
            <span className="block text-lg font-extrabold text-navy mb-3">Conta criada com sucesso</span>
            <p className="text-[13px] text-[#4A5C7A] leading-relaxed mb-5">
              Confira seu email pra confirmar a conta antes de entrar.
              <br />
              <span className="text-muted text-[12px]">
                (Se voce ainda nao configurou o confirmador de email no Supabase, ja pode entrar direto.)
              </span>
            </p>
            <button
              onClick={() => { playButtonSound(); navigate(withAppParams("/login")); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] cursor-pointer hover:opacity-90"
            >
              Ir pra tela de login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
      <Header onBack={() => navigate("/")} title="Cadastrar" />

      <div className="flex-1 flex items-start justify-center px-5 pt-8 pb-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4"
        >
          <Field
            icon={<IoPerson size={18} color="#9AAACA" />}
            label="Username"
            type="text"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            required
          />
          <Field
            icon={<IoMail size={18} color="#9AAACA" />}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <Field
            icon={<IoLockClosed size={18} color="#9AAACA" />}
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={6}
          />
          <Field
            icon={<IoLockClosed size={18} color="#9AAACA" />}
            label="Confirmar senha"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            required
            minLength={6}
          />

          <label className="flex items-start gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 cursor-pointer accent-brand"
            />
            <span className="text-[12px] text-[#4A5C7A] leading-snug">
              Eu li e aceito os{" "}
              <Link to="/termos" className="text-brand font-semibold underline">termos de uso</Link>
              {" "}e a{" "}
              <Link to="/privacy" className="text-brand font-semibold underline">politica de privacidade</Link>.
            </span>
          </label>

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
            {submitting ? "Criando conta..." : "Criar conta"}
          </button>

          <div className="text-center text-[13px] text-muted">
            Ja tem conta?{" "}
            <Link to={withAppParams("/login")} className="text-brand font-semibold underline">
              Entrar
            </Link>
          </div>
        </form>
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
  icon,
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12px] font-semibold text-navy tracking-wide">{label}</span>
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-cell-bg bg-white focus-within:border-brand transition-colors">
      {icon}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="flex-1 bg-transparent border-none outline-none text-[14px] text-navy"
      />
    </div>
  </label>
);
