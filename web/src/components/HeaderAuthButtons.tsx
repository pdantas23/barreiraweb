// === Botoes de auth pro cabecalho ===
//
// Componente reutilizavel. Em paginas anonimas mostra "Entrar" + "Cadastrar";
// quando logado, mostra um botao com o username que abre a tela /perfil.

import { useNavigate } from "react-router-dom";
import { IoPerson } from "react-icons/io5";
import { useAuth } from "../state/auth";
import { playButtonSound } from "../hooks/useButtonSound";

export const HeaderAuthButtons = () => {
  const navigate = useNavigate();
  const { user, username } = useAuth();

  return (
    <div className="flex items-center gap-1.5">
      {user ? (
        <button
          onClick={() => {
            playButtonSound();
            navigate("/perfil");
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
  );
};
