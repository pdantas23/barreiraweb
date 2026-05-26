import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gc } from "../gameColors";

type Props = {
  name: string;
  wallsLeft: number;
  totalWalls: number;
  isActive: boolean;
  isPlayer: boolean; // true = you, false = opponent
};

export const PlayerCard = ({
  name,
  wallsLeft,
  totalWalls,
  isActive,
  isPlayer,
}: Props) => {
  const gradientColors = isPlayer ? gc.cardBorderPlayer : gc.cardBorderOpponent;
  const dotColor = isPlayer ? gc.blue : gc.red;

  return (
    <View
      style={[
        styles.card,
        isActive && styles.cardActive,
      ]}
    >
      {/* Left accent border */}
      {!isActive && (
        <LinearGradient
          colors={[gradientColors[0], gradientColors[1]]}
          style={styles.accentBorder}
        />
      )}

      <View style={styles.content}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: isActive ? "rgba(255,255,255,0.25)" : `${dotColor}18`,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: isActive ? gc.white : dotColor },
            ]}
          >
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.info}>
          <Text
            style={[
              styles.name,
              { color: isActive ? gc.white : gc.textDark },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>

          {/* Mini wall dots */}
          <View style={styles.dots}>
            {Array.from({ length: totalWalls }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i < wallsLeft
                        ? isActive
                          ? gc.white
                          : dotColor
                        : isActive
                          ? "rgba(255,255,255,0.15)"
                          : `${dotColor}26`,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export const TurnArrow = ({ isPlayerTurn }: { isPlayerTurn: boolean }) => (
  <Text style={styles.arrow}>{isPlayerTurn ? "▶" : "◀"}</Text>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: gc.cardBg,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: gc.boardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardActive: {
    backgroundColor: gc.cardActiveBg,
  },
  accentBorder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingLeft: 12,
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "800",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 12,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: 2.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  arrow: {
    color: gc.blue,
    opacity: 0.5,
    fontSize: 12,
    marginHorizontal: 4,
  },
});
