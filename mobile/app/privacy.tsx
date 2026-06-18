import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  bgTop: "#F0F4FF",
  bgBottom: "#E8EEF8",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
} as const;

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={[C.bgTop, C.bgBottom]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={C.navy} />
          </Pressable>
          <Text style={styles.topTitle}>Política de Privacidade</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.updated}>Última atualização: 22 de maio de 2025</Text>

            <Text style={styles.heading}>1. Introdução</Text>
            <Text style={styles.body}>
              O Barreira ("nós", "nosso") é um jogo de tabuleiro multiplayer. Esta
              política descreve como tratamos informações quando você usa nosso
              aplicativo.
            </Text>

            <Text style={styles.heading}>2. Dados que coletamos</Text>
            <Text style={styles.body}>
              • Identificador de sessão: geramos um ID aleatório por instalação para
              permitir reconexão durante partidas online. Este ID não está vinculado à
              sua identidade real.{"\n\n"}
              • Nome de exibição: o nome mostrado aos oponentes durante partidas
              online (padrão: "Jogador"). Não é persistido em nossos servidores após
              o fim da partida.{"\n\n"}
              • Dados de conexão: endereço IP e metadados técnicos do WebSocket são
              processados em tempo real para manter a partida, mas não são
              armazenados permanentemente.
            </Text>

            <Text style={styles.heading}>3. Como usamos os dados</Text>
            <Text style={styles.body}>
              Os dados são usados exclusivamente para:{"\n\n"}
              • Estabelecer e manter conexões de partida em tempo real{"\n"}
              • Permitir reconexão em caso de perda temporária de rede{"\n"}
              • Exibir nomes dos jogadores durante a partida
            </Text>

            <Text style={styles.heading}>4. Compartilhamento de dados</Text>
            <Text style={styles.body}>
              Não vendemos, compartilhamos ou transferimos seus dados para terceiros.
              Não utilizamos serviços de analytics ou publicidade.
            </Text>

            <Text style={styles.heading}>5. Armazenamento</Text>
            <Text style={styles.body}>
              Não mantemos banco de dados de usuários. Os dados de sessão existem
              apenas na memória do servidor durante partidas ativas e são descartados
              quando a partida termina ou o servidor reinicia.
            </Text>

            <Text style={styles.heading}>6. Seus direitos</Text>
            <Text style={styles.body}>
              Como não armazenamos dados pessoais permanentes, não há dados para
              solicitar exclusão. O identificador de sessão é regenerado ao
              reinstalar o aplicativo.
            </Text>

            <Text style={styles.heading}>7. Crianças</Text>
            <Text style={styles.body}>
              O Barreira não coleta intencionalmente dados de crianças menores de 13
              anos. O app não requer cadastro nem dados pessoais.
            </Text>

            <Text style={styles.heading}>8. Alterações</Text>
            <Text style={styles.body}>
              Podemos atualizar esta política. Alterações significativas serão
              comunicadas através de atualização do app.
            </Text>

            <Text style={styles.heading}>9. Contato</Text>
            <Text style={styles.body}>
              Em caso de dúvidas sobre privacidade, entre em contato pelo email:
              paulovitorengcomp@gmail.com
            </Text>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    color: C.navy,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  updated: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 16,
  },
  heading: {
    fontSize: 14,
    fontWeight: "800",
    color: C.navy,
    marginTop: 18,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    color: "#4A5C7A",
    lineHeight: 20,
  },
});
