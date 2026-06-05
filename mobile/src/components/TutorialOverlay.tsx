import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { TutorialStep } from "../tutorial/script";

// Banner de instrução (coach-mark) renderizado INLINE no topo da tela do
// tutorial — não é um scrim que escurece tudo de propósito: o objetivo é manter
// o tabuleiro e o banco de paredes totalmente interativos. O destaque das casas
// válidas vem do próprio Board (validMoves) e do banco de paredes. Sem animações
// em loop / essenciais → nada a desabilitar pra reduce-motion.

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  white: "#FFFFFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  cell: "#EEF2FF",
} as const;

type Props = {
  step: TutorialStep;
  index: number;
  total: number;
  /** Avança o passo (só relevante em passos "info"). */
  onNext: () => void;
  /** Sai do tutorial (marca como visto). */
  onSkip: () => void;
};

export const TutorialOverlay = ({ step, index, total, onNext, onSkip }: Props) => {
  const isInfo = step.kind === "info";

  return (
    <View style={styles.root}>
      <View
        style={styles.card}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`Tutorial, passo ${index + 1} de ${total}. ${step.text}`}
      >
        {/* Progresso */}
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.text}>{step.text}</Text>

        {!isInfo && (
          <Text style={styles.waiting}>👆 Sua vez — faça a jogada acima</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Pular tutorial"
            hitSlop={10}
            style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>Pular</Text>
          </Pressable>

          {isInfo && (
            <Pressable
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={step.cta ?? "Próximo"}
              style={({ pressed }) => [{ flexShrink: 1 }, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[C.blue, C.blueLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtn}
              >
                <Text style={styles.nextText}>{step.cta ?? "Próximo"}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(61,111,255,0.18)",
    shadowColor: C.blue,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.cell,
  },
  dotActive: {
    backgroundColor: C.blue,
    width: 16,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: C.navy,
  },
  waiting: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: C.blue,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.muted,
  },
  nextBtn: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
