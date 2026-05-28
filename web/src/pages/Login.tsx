import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IoArrowBack, IoPerson, IoLockClosed } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";
import { redirectToAppIfFromApp, withAppParams } from "../net/deepLink";
import { supabase } from "../net/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn({ emailOrUsername, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    playButtonSound();

    // Se o usuário veio do app mobile (?from=app&redirect=...), redireciona
    // pro deep link com tokens da sessão — app intercepta e fica logado.
    const { data } = await supabase.auth.getSession();
    if (redirectToAppIfFromApp(data.session)) return;

    navigate("/");
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
      <Header onBack={() => navigate("/")} title="Entrar" />

      <div className="flex-1 flex items-start justify-center px-5 pt-8 pb-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4"
        >
          <Field
            icon={<IoPerson size={18} color="#9AAACA" />}
            label="Email ou username"
            type="text"
            value={emailOrUsername}
            onChange={setEmailOrUsername}
            autoComplete="username"
            required
          />
          <Field
            icon={<IoLockClosed size={18} color="#9AAACA" />}
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
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
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-center text-[13px]">
            <Link to={withAppParams("/esqueci-senha")} className="text-brand font-semibold underline">
              Esqueci minha senha
            </Link>
          </div>

          <div className="text-center text-[13px] text-muted">
            Nao tem conta?{" "}
            <Link to={withAppParams("/cadastro")} className="text-brand font-semibold underline">
              Cadastrar
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
