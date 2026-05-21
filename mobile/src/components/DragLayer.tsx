import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import type { WallType } from "@barreira/shared";
import { theme } from "../theme";
import type { BoardLayout } from "../hooks/useResponsiveBoard";

type Props = {
  type: WallType;
  // Coords absolutas do dedo (e.absoluteX/Y do gesture). Esse componente
  // vive dentro do GestureHandlerRootView (no _layout.tsx), o MESMO container
  // onde o gesture-handler mede as coords — então position:absolute aqui bate
  // 1:1 com o dedo, sem offset de header/statusbar.
  //
  // FALLBACK: se em algum device a parede flutuante ainda aparecer abaixo
  // do dedo, é sinal que um SafeAreaView interno do expo-router está dando
  // offset. Nesse caso, importa StatusBar de "react-native" e subtrai:
  //   const offset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  //   { translateY: dragY.value - h / 2 - offset }
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  layout: BoardLayout;
};

export const DragLayer = ({ type, dragX, dragY, layout }: Props) => {
  const isH = type === "h";
  const w = isH ? layout.squareSize * 2 + layout.gap : layout.wallThickness;
  const h = isH ? layout.wallThickness : layout.squareSize * 2 + layout.gap;

  // Centro geográfico da parede sobre o dedo: subtrai metade da largura e altura.
  // useAnimatedStyle roda na UI thread (sem React render).
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - w / 2 },
      { translateY: dragY.value - h / 2 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: h,
          backgroundColor: theme.player1,
          opacity: 0.75,
          borderRadius: 4,
          shadowColor: theme.player1,
          shadowOpacity: 0.7,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        },
        animatedStyle,
      ]}
    />
  );
};
