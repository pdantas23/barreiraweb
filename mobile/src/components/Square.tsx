import { Pressable, View, StyleSheet } from "react-native";
import { col, row } from "@barreira/shared";
import { gc } from "../gameColors";

type Props = {
  size: number;
  index: number;
  isAlt: boolean;
  isHighlighted: boolean;
  onPress?: (index: number) => void;
  children?: React.ReactNode;
};

export const Square = ({
  size,
  index,
  isAlt: _isAlt,
  isHighlighted,
  onPress,
  children,
}: Props) => {
  // Só as casas clicáveis (jogada válida) são expostas ao leitor de tela, como
  // botão. As demais saem do foco — 81 células vazias só virariam ruído. Sem
  // hitSlop: casas são adjacentes, expandir o toque causaria lance na errada.
  const pressable = !!onPress;
  return (
    <Pressable
      onPress={onPress ? () => onPress(index) : undefined}
      accessible={pressable}
      accessibilityRole={pressable ? "button" : undefined}
      accessibilityLabel={
        pressable ? `Mover para coluna ${col(index) + 1}, linha ${row(index) + 1}` : undefined
      }
      importantForAccessibility={pressable ? "yes" : "no-hide-descendants"}
      style={[
        styles.square,
        {
          width: size,
          height: size,
          backgroundColor: gc.cell,
          borderColor: isHighlighted ? gc.validMoveBorder : gc.cellBorder,
          borderWidth: isHighlighted ? 1.5 : 0.5,
          borderStyle: isHighlighted ? "dashed" : "solid",
        },
        isHighlighted && styles.highlighted,
      ]}
    >
      <View style={styles.center}>{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  square: {
    borderRadius: gc.cellRadius,
  },
  highlighted: {
    backgroundColor: gc.validMoveBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
