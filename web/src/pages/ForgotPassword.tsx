import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IoArrowBack, IoMail } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await sendPasswordReset(email);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    playButtonSound();
    setSent(true);
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-bg-top to-bg-bottom">
      <Header onBack={() => navigate("/login")} title="Recuperar senha" />

      <div className="flex-1 flex items-start justify-center px-5 pt-8 pb-12">
        {sent ? (
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4 items-center text-center">
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
              <IoMail size={28} color="#3D6FFF" />
            </div>
            <h2 className="text-[16px] font-extrabold text-navy">Email enviado</h2>
            <p className="text-[13px] text-muted">
              Se houver uma conta com o email <strong className="text-navy">{email}</strong>, enviamos um link de recuperação. Confira sua caixa de entrada (e o spam) e clique no link para escolher uma nova senha.
            </p>
            <Link
              to="/login"
              className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light text-white font-black text-[15px] tracking-wide text-center hover:opacity-90 transition-opacity"
            >
              Voltar pro login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="w-full max-w-[380px] bg-white rounded-2xl p-6 shadow-[0_8px_20px_rgba(61,111,255,0.15)] flex flex-col gap-4"
          >
            <p className="text-[13px] text-muted">
              Informe o email cadastrado e vamos enviar um link pra você criar uma nova senha.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-navy tracking-wide">Email</span>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-cell-bg bg-white focus-within:border-brand transition-colors">
                <IoMail size={18} color="#9AAACA" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="flex-1 bg-transparent border-none outline-none text-[14px] text-navy"
                />
              </div>
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
              {submitting ? "Enviando..." : "Enviar link"}
            </button>

            <div className="text-center text-[13px] text-muted">
              <Link to="/login" className="text-brand font-semibold underline">
                Voltar pro login
              </Link>
            </div>
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
