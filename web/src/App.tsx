import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DragOverlayProvider, useDragOverlay } from "./state/dragOverlay";
import { AudioSettingsProvider } from "./state/audioSettings";
import { ProfileProvider } from "./state/profile";
import { AuthProvider } from "./state/auth";
import { DragLayer } from "./components/DragLayer";
import { initClientId } from "./net/clientId";
import Home from "./pages/Home";
import Game from "./pages/Game";
import OnlineGame from "./pages/OnlineGame";
import Privacy from "./pages/Privacy";
import Regras from "./pages/Regras";
import Estrategias from "./pages/Estrategias";
import Sobre from "./pages/Sobre";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Termos from "./pages/Termos";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AmigoRedirect from "./pages/AmigoRedirect";
import SalaRedirect from "./pages/SalaRedirect";
import AdminStats from "./pages/AdminStats";
// Replay Builder: ferramenta interna, rota registrada só em dev.
import ReplayBuilder from "./pages/ReplayBuilder";

// Bootstrap clientId synchronously (localStorage is sync)
initClientId();

const DragOverlayRenderer = () => {
  const { overlay, dragX, dragY } = useDragOverlay();
  if (!overlay) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999 }}>
      <DragLayer
        type={overlay.type}
        dragX={dragX}
        dragY={dragY}
        layout={overlay.layout}
      />
    </div>
  );
};

export const App = () => {
  return (
    <BrowserRouter>
      <DragOverlayProvider>
        <AudioSettingsProvider>
          <AuthProvider>
            <ProfileProvider>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/amigo/:username" element={<AmigoRedirect />} />
                <Route path="/sala/:codigo" element={<SalaRedirect />} />
                <Route path="/game" element={<Game />} />
                <Route path="/online-game" element={<OnlineGame />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/regras" element={<Regras />} />
                <Route path="/estrategias" element={<Estrategias />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/admin/stats" element={<AdminStats />} />
                {import.meta.env.DEV && (
                  <Route path="/replay-builder" element={<ReplayBuilder />} />
                )}
              </Routes>
              <DragOverlayRenderer />
            </ProfileProvider>
          </AuthProvider>
        </AudioSettingsProvider>
      </DragOverlayProvider>
    </BrowserRouter>
  );
};
