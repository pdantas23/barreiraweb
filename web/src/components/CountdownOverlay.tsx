import { useCallback, useEffect, useState } from "react";
import { gc } from "../gameColors";

const COUNTDOWN_DURATION_MS = 3_000;

type Props = {
  startsAt: number;
  onComplete: () => void;
};

export const CountdownOverlay = ({ startsAt, onComplete }: Props) => {
  const [seconds, setSeconds] = useState(3);
  const [visible, setVisible] = useState(true);

  const onCompleteStable = useCallback(onComplete, [onComplete]);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startsAt;
      const remaining = Math.ceil((COUNTDOWN_DURATION_MS - elapsed) / 1000);
      if (remaining <= 0) {
        setVisible(false);
        onCompleteStable();
        return;
      }
      setSeconds(remaining);
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [startsAt, onCompleteStable]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(240,244,255,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        animation: "fadeIn 150ms ease-out",
      }}
    >
      <div
        key={seconds}
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(61,111,255,0.08)",
          border: `3px solid ${gc.blue}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "zoomIn 250ms ease-out",
        }}
      >
        <span
          style={{
            color: gc.blue,
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: 2,
          }}
        >
          {seconds}
        </span>
      </div>
    </div>
  );
};
