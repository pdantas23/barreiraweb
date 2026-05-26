// === Botoes de auth pro cabecalho ===
//
// Componente reutilizavel. Em paginas anonimas mostra "Entrar" + "Cadastrar";
// quando logado, mostra um botao com o username que abre menu de perfil/sair.
//
// Inclui o modal de menu do usuario embutido pra qualquer pagina poder usar
// sem precisar copiar codigo.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoLogOutOutline, IoPerson } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";

export const HeaderAuthButtons = () => {
  const navigate = useNavigate();
  const { user, username, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5">
        {user ? (
          <button
            onClick={() => {
              playButtonSound();
              setShowUserMenu(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-brand/10 hover:bg-brand/20 cursor-pointer transition-colors border-none"
          >
            <IoPerson size={14} color="#3D6FFF" />
            <span className="text-brand text-[12px] font-bold max-w-[80px] truncate">
              {username ?? "Perfil"}
            </span>
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                playButtonSound();
                navigate("/login");
              }}
              className="px-2.5 py-1.5 rounded-lg text-brand text-[12px] font-bold cursor-pointer bg-transparent border-none hover:bg-brand/5 transition-colors whitespace-nowrap"
            >
              Entrar
            </button>
            <button
              onClick={() => {
                playButtonSound();
                navigate("/cadastro");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-brand text-white text-[12px] font-bold cursor-pointer border-none hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Cadastrar
            </button>
          </>
        )}
      </div>

      {showUserMenu && user && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[300]"
          onClick={() => setShowUserMenu(false)}
        >
          <div
            className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mb-3">
              <IoPerson size={28} color="#3D6FFF" />
            </div>
            <span className="text-lg font-extrabold text-navy">
              {username ?? "Perfil"}
            </span>
            <span className="text-[12px] text-muted mb-5 break-all text-center">
              {user.email}
            </span>

            <button
              onClick={async () => {
                playButtonSound();
                await signOut();
                setShowUserMenu(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cell-bg border-none text-navy font-bold text-sm cursor-pointer hover:opacity-80"
            >
              <IoLogOutOutline size={18} color="#1A2A4A" />
              Sair da conta
            </button>

            <button
              onClick={() => setShowUserMenu(false)}
              className="mt-3 text-muted text-[12px] font-semibold underline cursor-pointer bg-transparent border-none"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
