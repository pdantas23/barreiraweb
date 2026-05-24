import { useEffect, useState, type ReactNode } from "react";

type Props = {
  ready?: boolean;
  children: ReactNode;
};

const SPINNER = (
  <div
    style={{
      width: 36,
      height: 36,
      border: "3px solid #3D6FFF",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }}
  />
);

export const PageGate = ({ ready: externalReady = true, children }: Props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visible = mounted && externalReady;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(to bottom, #F0F4FF, #E8EEF8)",
          opacity: visible ? 0 : 1,
          pointerEvents: visible ? "none" : "auto",
          transition: "opacity 220ms ease-out",
          zIndex: 50,
        }}
      >
        {SPINNER}
      </div>
      <div
        style={{
          width: "100%",
          height: "100%",
          opacity: visible ? 1 : 0,
          transition: "opacity 260ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
};
