import { Pressable, View, StyleSheet } from "react-native";
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
  return (
    <Pressable
      onPress={onPress ? () => onPress(index) : undefined}
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
