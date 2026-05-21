// Identidade persistente do cliente — serve pro server reanexar a sala
// quando o socket cai e volta (Wi-Fi instável, app em background, etc).
//
// Por enquanto persiste só em memória (singleton no módulo). Sobrevive a
// reconexões de socket dentro da mesma sessão do app, mas zera ao matar.
// Quando AsyncStorage entrar no projeto, troca por leitura/escrita em disco
// — a interface fica igual.

let cached: string | null = null;

const generate = (): string => {
  // Suficientemente único pra propósito do lobby (não precisa ser crypto-strong).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getClientId = (): string => {
  if (!cached) cached = generate();
  return cached;
};
