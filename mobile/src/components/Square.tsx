import { Pressable, View, StyleSheet } from "react-native";
import { theme } from "../theme";

type Props = {
  size: number;
  index: number;
  isAlt: boolean;
  isHighlighted: boolean;
  highlightColor?: string;
  onPress?: (index: number) => void;
  children?: React.ReactNode;
};

export const Square = ({
  size,
  index,
  isAlt,
  isHighlighted,
  highlightColor,
  onPress,
  children,
}: Props) => {
  const bg = isHighlighted
    ? highlightColor ?? theme.validMove
    : isAlt
      ? theme.squareAlt
      : theme.square;

  return (
    <Pressable
      onPress={onPress ? () => onPress(index) : undefined}
      style={[styles.square, { width: size, height: size, backgroundColor: bg }]}
    >
      <View style={styles.center}>{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  square: { borderRadius: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
