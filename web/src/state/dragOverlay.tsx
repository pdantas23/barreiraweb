import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WallType } from "@barreira/shared";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Overlay = { type: WallType; layout: BoardLayout } | null;

type Ctx = {
  dragX: React.MutableRefObject<number>;
  dragY: React.MutableRefObject<number>;
  lastInter: React.MutableRefObject<string>;
  overlay: Overlay;
  show: (type: WallType, layout: BoardLayout) => void;
  hide: () => void;
};

const DragContext = createContext<Ctx | null>(null);

export const DragOverlayProvider = ({ children }: { children: ReactNode }) => {
  const dragX = useRef(0);
  const dragY = useRef(0);
  const lastInter = useRef("");
  const [overlay, setOverlay] = useState<Overlay>(null);

  const show = useCallback(
    (type: WallType, layout: BoardLayout) => setOverlay({ type, layout }),
    [],
  );
  const hide = useCallback(() => setOverlay(null), []);

  const value = useMemo<Ctx>(
    () => ({ dragX, dragY, lastInter, overlay, show, hide }),
    [overlay, show, hide],
  );

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
};

export const useDragOverlay = (): Ctx => {
  const c = useContext(DragContext);
  if (!c) throw new Error("useDragOverlay deve estar dentro de DragOverlayProvider");
  return c;
};
