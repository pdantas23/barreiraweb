const COLS = 30;
const ROWS = 20;
const CELL = 52;
const GAP = 8;
const RADIUS = 8;
const GRID_COLOR = "#3D6FFF";
const GRID_OPACITY = 0.11;

const WALLS: { x: number; y: number; w: number; h: number; color: string }[] = [
  { x: 79, y: 59, w: 52, h: 7, color: "#FF3D6F" },
  { x: 259, y: 179, w: 52, h: 7, color: "#3D6FFF" },
  { x: 139, y: 299, w: 52, h: 7, color: "#FF3D6F" },
  { x: 319, y: 419, w: 52, h: 7, color: "#3D6FFF" },
  { x: 79, y: 539, w: 52, h: 7, color: "#FF3D6F" },
  { x: 199, y: 659, w: 52, h: 7, color: "#3D6FFF" },
  { x: 259, y: 779, w: 52, h: 7, color: "#FF3D6F" },
  { x: 13, y: 426, w: 7, h: 52, color: "#3D6FFF" },
  { x: 193, y: 126, w: 7, h: 52, color: "#FF3D6F" },
  { x: 373, y: 306, w: 7, h: 52, color: "#3D6FFF" },
  { x: 133, y: 486, w: 7, h: 52, color: "#FF3D6F" },
  { x: 313, y: 606, w: 7, h: 52, color: "#3D6FFF" },
  { x: 73, y: 726, w: 7, h: 52, color: "#FF3D6F" },
  { x: 253, y: 366, w: 7, h: 52, color: "#3D6FFF" },
  { x: 373, y: 546, w: 7, h: 52, color: "#FF3D6F" },
  { x: 133, y: 186, w: 7, h: 52, color: "#3D6FFF" },
  // Extended walls for wider screens
  { x: 559, y: 119, w: 52, h: 7, color: "#FF3D6F" },
  { x: 739, y: 239, w: 52, h: 7, color: "#3D6FFF" },
  { x: 619, y: 479, w: 52, h: 7, color: "#FF3D6F" },
  { x: 859, y: 359, w: 52, h: 7, color: "#3D6FFF" },
  { x: 979, y: 539, w: 52, h: 7, color: "#FF3D6F" },
  { x: 1099, y: 179, w: 52, h: 7, color: "#3D6FFF" },
  { x: 1219, y: 659, w: 52, h: 7, color: "#FF3D6F" },
  { x: 493, y: 246, w: 7, h: 52, color: "#3D6FFF" },
  { x: 673, y: 426, w: 7, h: 52, color: "#FF3D6F" },
  { x: 853, y: 126, w: 7, h: 52, color: "#3D6FFF" },
  { x: 733, y: 606, w: 7, h: 52, color: "#FF3D6F" },
  { x: 1033, y: 366, w: 7, h: 52, color: "#3D6FFF" },
  { x: 1153, y: 486, w: 7, h: 52, color: "#FF3D6F" },
  { x: 913, y: 726, w: 7, h: 52, color: "#3D6FFF" },
];

export const GridBackground = () => {
  const cells: React.ReactNode[] = [];
  const startX = 19;
  const startY = 6;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: startX + c * (CELL + GAP),
            top: startY + r * (CELL + GAP),
            width: CELL,
            height: CELL,
            borderRadius: RADIUS,
            border: `1px solid ${GRID_COLOR}`,
            opacity: GRID_OPACITY,
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {cells}

      {WALLS.map((w, i) => (
        <div
          key={`wall-${i}`}
          style={{
            position: "absolute",
            left: w.x,
            top: w.y,
            width: w.w,
            height: w.h,
            borderRadius: 3.5,
            backgroundColor: w.color,
            opacity: 0.13,
          }}
        />
      ))}

      {/* Edge fades */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(to bottom, #F0F4FF, rgba(240,244,255,0))",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(to bottom, rgba(232,238,248,0), #E8EEF8)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 40,
          background: "linear-gradient(to right, #F0F4FF, rgba(240,244,255,0))",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 40,
          background: "linear-gradient(to right, rgba(240,244,255,0), #E8EEF8)",
          zIndex: 1,
        }}
      />
    </div>
  );
};
