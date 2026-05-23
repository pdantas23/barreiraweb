import type React from "react";
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
  isHighlighted,
  onPress,
  children,
}: Props) => {
  return (
    <div
      onClick={onPress ? () => onPress(index) : undefined}
      style={{
        width: size,
        height: size,
        backgroundColor: isHighlighted ? gc.validMoveBg : gc.cell,
        borderColor: isHighlighted ? gc.validMoveBorder : gc.cellBorder,
        borderWidth: isHighlighted ? 1.5 : 0.5,
        borderStyle: isHighlighted ? "dashed" : "solid",
        borderRadius: gc.cellRadius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onPress ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
};
