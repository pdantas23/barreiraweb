import React, { useEffect, useState } from "react";
import { IoChevronForward, IoFlash, IoGameController, IoMusicalNotes, IoSettingsOutline, IoShieldCheckmark, IoVolumeHigh } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { GridBackground } from "../components/GridBackground";
import { HeaderAuthButtons } from "../components/HeaderAuthButtons";
import { playButtonSound, setSfxEnabledForSounds, useButtonSound } from "../hooks/useButtonSound";
import { useMenuMusic } from "../hooks/useMenuMusic";
import { setSfxEnabledForPiece } from "../hooks/usePieceSound";
import { setSfxEnabledForWall } from "../hooks/useWallSound";
import { PageGate } from "../components/PageGate";
import { useAudioSettings } from "../state/audioSettings";

const PRIVACY_ACCEPTED_KEY = "privacy_accepted";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Facil" },
  { key: "medium", label: "Medio" },
  { key: "hard", label: "Dificil" },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [offlineModal, setOfflineModal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled } = useAudioSettings();
  useButtonSound();
  useMenuMusic(musicEnabled);

  useEffect(() => {
    setSfxEnabledForSounds(sfxEnabled);
    setSfxEnabledForPiece(sfxEnabled);
    setSfxEnabledForWall(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    if (!localStorage.getItem(PRIVACY_ACCEPTED_KEY)) setShowPrivacy(true);
  }, []);

  const onAcceptPrivacy = () => {
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, "1");
    setShowPrivacy(false);
  };

  const onPlayCasual = () => {
    playButtonSound();
    navigate("/online");
  };

  const onStartOffline = () => {
    playButtonSound();
    setOfflineModal(false);
    navigate(`/game?difficulty=${difficulty}`);
  };

  return (
    <PageGate ready={logoLoaded}>
    <div className="h-full flex flex-col relative bg-gradient-to-b from-bg-top to-bg-bottom overflow-hidden">
      {/* Top navbar */}
      <div className="w-full flex items-center px-4 py-3 z-10 border-b border-brand/8" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="flex-1" />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2.5rem", color: "#3D6FFF", letterSpacing: 4 }}>BARREIRA</span>
        <div className="flex-1 flex justify-end gap-1.5 items-center">
          <HeaderAuthButtons />
          <button
            onClick={() => { playButtonSound(); setShowSettings(true); }}
            className="w-9 h-9 rounded-full bg-white border border-cell-bg flex items-center justify-center cursor-pointer hover:opacity-80"
          >
            <IoSettingsOutline size={16} color="#9AAACA" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        <GridBackground />

        <div className="absolute inset-0 flex items-center justify-center px-5">
          <div className="flex flex-col items-center gap-0">
            <img
              src="/photos/art.png"
              alt="Barreira"
              className="w-[min(400px,65vw)] object-contain rounded-3xl -mb-10"
              onLoad={() => setLogoLoaded(true)}
              onError={() => setLogoLoaded(true)}
            />

            {/* Two buttons */}
            <div className="flex flex-row gap-4 w-[min(320px,60vw)]">
              <button
                onClick={() => { playButtonSound(); setOfflineModal(true); }}
                className="flex-1 h-[clamp(44px,7vh,58px)] rounded-2xl bg-white border-2 border-brand flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all"
              >
                <IoGameController size={18} color="#3D6FFF" />
                <span className="text-brand text-[15px] font-black tracking-[1px]">TREINO</span>
              </button>
              <button
                onClick={onPlayCasual}
                className="flex-1 h-[clamp(44px,7vh,58px)] rounded-2xl bg-gradient-to-r from-brand to-brand-light border-none flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all"
              >
                <IoFlash size={18} color="#FFFFFF" />
                <span className="text-white text-[15px] font-black tracking-[1px]">CASUAL</span>
              </button>
            </div>

            <button
              onClick={() => { playButtonSound(); navigate("/regras"); }}
              className="mt-2 text-muted text-[12px] font-semibold underline cursor-pointer bg-transparent border-none hover:text-brand"
            >
              Regras
            </button>
          </div>
        </div>
      </div>

      {/* Footer com links de conteudo */}
      <div className="flex-shrink-0 flex flex-row items-center justify-center gap-3 py-3 px-4 border-t border-cell-bg bg-white/60">
        <button
          onClick={() => { playButtonSound(); navigate("/regras"); }}
          className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
        >
          Regras
        </button>
        <span className="text-muted text-[11px]">·</span>
        <button
          onClick={() => { playButtonSound(); navigate("/estrategias"); }}
          className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
        >
          Estratégias
        </button>
        <span className="text-muted text-[11px]">·</span>
        <button
          onClick={() => { playButtonSound(); navigate("/sobre"); }}
          className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
        >
          Sobre
        </button>
        <span className="text-muted text-[11px]">·</span>
        <button
          onClick={() => { playButtonSound(); navigate("/privacy"); }}
          className="text-muted text-[11px] font-semibold hover:text-brand bg-transparent border-none cursor-pointer"
        >
          Privacidade
        </button>
      </div>

      {/* Difficulty modal */}
      {offlineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[200]" onClick={() => setOfflineModal(false)}>
          <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
            <span className="text-lg font-extrabold text-navy mb-5">Escolha a dificuldade</span>

            <div className="flex flex-row gap-2.5 mb-4 w-[280px]">
              {DIFFICULTIES.map((d) => {
                const active = difficulty === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => { playButtonSound(); setDifficulty(d.key); }}
                    className={`flex-1 py-2.5 rounded-3xl border-[1.5px] text-sm font-bold cursor-pointer transition-colors ${
                      active
                        ? "bg-brand border-brand text-white"
                        : "bg-white border-muted text-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-row gap-2.5 mt-5 w-full">
              <button
                onClick={() => setOfflineModal(false)}
                className="flex-1 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80"
              >
                Cancelar
              </button>
              <button
                onClick={onStartOffline}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
              >
                Jogar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[300]">
          <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]">
            <div className="mb-2"><IoShieldCheckmark size={36} color="#3D6FFF" /></div>
            <span className="text-lg font-extrabold text-navy mb-5">Politica de Privacidade</span>
            <div className="max-h-80 overflow-auto w-full">
              <p className="text-[13px] text-[#4A5C7A] leading-relaxed">
                O Barreira coleta apenas um identificador de sessao aleatorio para permitir reconexao durante partidas online. Nao coletamos dados pessoais, nao usamos analytics nem publicidade.
                <br /><br />
                Seu nome de exibicao e visivel aos oponentes durante a partida e nao e armazenado permanentemente.
                <br /><br />
                Ao continuar, voce concorda com nossa Politica de Privacidade completa, acessivel a qualquer momento no menu do app.
              </p>
            </div>
            <button
              onClick={onAcceptPrivacy}
              className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-light border-none text-white font-black text-[15px] tracking-wide cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
            >
              Aceitar e Continuar
            </button>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-[300]" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-[340px] bg-white rounded-2xl p-6 flex flex-col items-center shadow-[0_8px_20px_rgba(61,111,255,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2"><IoSettingsOutline size={32} color="#3D6FFF" /></div>
            <span className="text-lg font-extrabold text-navy mb-5">Configuracoes</span>

            <SettingRow icon={<IoMusicalNotes size={20} color="#1A2A4A" />} label="Musica">
              <Toggle active={musicEnabled} onToggle={() => setMusicEnabled(!musicEnabled)} />
            </SettingRow>
            <SettingRow icon={<IoVolumeHigh size={20} color="#1A2A4A" />} label="Efeitos sonoros">
              <Toggle active={sfxEnabled} onToggle={() => setSfxEnabled(!sfxEnabled)} />
            </SettingRow>
            <div
              onClick={() => { setShowSettings(false); navigate("/privacy"); }}
              className="flex flex-row items-center justify-between w-full py-3.5 border-b border-cell-bg cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <IoShieldCheckmark size={20} color="#1A2A4A" />
                <span className="text-[15px] font-semibold text-navy">Politica de Privacidade</span>
              </div>
              <IoChevronForward size={18} color="#9AAACA" />
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-4 px-8 py-3 rounded-xl bg-cell-bg border-none text-muted font-bold text-sm cursor-pointer hover:opacity-80"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
    </PageGate>
  );
}

const SettingRow = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex flex-row items-center justify-between w-full py-3.5 border-b border-cell-bg">
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="text-[15px] font-semibold text-navy">{label}</span>
    </div>
    {children}
  </div>
);

const Toggle = ({ active, onToggle }: { active: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`w-12 h-7 rounded-full border-none flex items-center px-0.5 cursor-pointer transition-colors duration-200 ${
      active ? "bg-brand justify-end" : "bg-gray-300 justify-start"
    }`}
  >
    <div className="w-6 h-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
  </button>
);
