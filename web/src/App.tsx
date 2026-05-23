import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DragOverlayProvider, useDragOverlay } from "./state/dragOverlay";
import { AudioSettingsProvider } from "./state/audioSettings";
import { ProfileProvider } from "./state/profile";
import { DragLayer } from "./components/DragLayer";
import { initClientId } from "./net/clientId";
import Home from "./pages/Home";
import Game from "./pages/Game";
import Online from "./pages/Online";
import OnlineGame from "./pages/OnlineGame";
import Privacy from "./pages/Privacy";

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
          <ProfileProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/game" element={<Game />} />
              <Route path="/online" element={<Online />} />
              <Route path="/online-game" element={<OnlineGame />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
            <DragOverlayRenderer />
          </ProfileProvider>
        </AudioSettingsProvider>
      </DragOverlayProvider>
    </BrowserRouter>
  );
};
