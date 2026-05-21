import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type { WallType } from "@barreira/shared";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Overlay = { type: WallType; layout: BoardLayout } | null;

type Ctx = {
  // Shared values criados aqui (no nível do _layout, fora do GameScreen).
  // Tanto WallBank quanto DragLayer leem os mesmos shared values — sem
  // duplicação e sem offset de container.
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  lastInter: SharedValue<string>;
  // O que renderizar (ou null se nada está sendo arrastado)
  overlay: Overlay;
  show: (type: WallType, layout: BoardLayout) => void;
  hide: () => void;
};

const DragContext = createContext<Ctx | null>(null);

export const DragOverlayProvider = ({ children }: { children: ReactNode }) => {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lastInter = useSharedValue("");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const show = useCallback(
    (type: WallType, layout: BoardLayout) => setOverlay({ type, layout }),
    [],
  );
  const hide = useCallback(() => setOverlay(null), []);

  const value = useMemo<Ctx>(
    () => ({ dragX, dragY, lastInter, overlay, show, hide }),
    [dragX, dragY, lastInter, overlay, show, hide],
  );

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
};

export const useDragOverlay = (): Ctx => {
  const c = useContext(DragContext);
  if (!c) throw new Error("useDragOverlay deve estar dentro de DragOverlayProvider");
  return c;
};
