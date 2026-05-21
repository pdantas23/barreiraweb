import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const COLS = 6;
const ROWS = 14;
const CELL = 52;
const GAP = 8;
const RADIUS = 8;
const GRID_COLOR = "#3D6FFF";
const GRID_OPACITY = 0.11;

// Wall accent positions (from the SVG)
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
];

export const GridBackground = () => {
  const cells: React.ReactNode[] = [];
  const startX = 19;
  const startY = 6;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: startX + c * (CELL + GAP),
            top: startY + r * (CELL + GAP),
            width: CELL,
            height: CELL,
            borderRadius: RADIUS,
            borderWidth: 1,
            borderColor: GRID_COLOR,
            opacity: GRID_OPACITY,
          }}
        />,
      );
    }
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Grid cells */}
      {cells}

      {/* Wall accents */}
      {WALLS.map((w, i) => (
        <View
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
      <LinearGradient
        colors={["#F0F4FF", "rgba(240,244,255,0)"]}
        style={styles.fadeTop}
      />
      <LinearGradient
        colors={["rgba(232,238,248,0)", "#E8EEF8"]}
        style={styles.fadeBottom}
      />
      <LinearGradient
        colors={["#F0F4FF", "rgba(240,244,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeLeft}
      />
      <LinearGradient
        colors={["rgba(240,244,255,0)", "#E8EEF8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeRight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 1,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 1,
  },
  fadeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 40,
    zIndex: 1,
  },
  fadeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 40,
    zIndex: 1,
  },
});
