// Mapeia códigos de erro do protocolo (RpcError) em título + mensagem
// amigáveis em PT, prontos pra Alert.alert(). Cada call site pode
// sobrescrever a mensagem com `res.message` se o server mandar algo
// mais específico, mas o título sempre vem daqui.

import type { RpcError } from "@barreira/shared";

export type ErrorInfo = {
  title: string;
  message: string;
};

export const errorInfo = (err: string): ErrorInfo => {
  switch (err as RpcError) {
    case "room-not-found":
      return {
        title: "Sala não encontrada",
        message: "Confere se o código está certo — pode ter expirado.",
      };
    case "room-full":
      return {
        title: "Sala cheia",
        message: "Essa sala já tem 2 jogadores.",
      };
    case "wrong-password":
      return {
        title: "Senha incorreta",
        message: "Confere a senha com quem criou a sala.",
      };
    case "already-in-room":
      return {
        title: "Você já está numa sala",
        message: "Saia da partida atual antes de entrar em outra.",
      };
    case "self-match":
      return {
        title: "Você não pode jogar contra si mesmo",
        message: "Essa sala foi criada pela sua própria conta em outra sessão.",
      };
    case "not-in-room":
      return {
        title: "Sala não encontrada",
        message: "Você não está mais nessa partida.",
      };
    case "invalid-payload":
      return {
        title: "Dados inválidos",
        message: "Tente novamente.",
      };
    case "internal-error":
      return {
        title: "Sem conexão",
        message: "Não consegui falar com o servidor. Verifica sua internet.",
      };
    default:
      return {
        title: "Algo deu errado",
        message: `Tente novamente em alguns segundos.`,
      };
  }
};
