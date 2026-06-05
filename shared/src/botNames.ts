// === Nomes realistas pra bots ===
//
// Substitui o antigo "anonimo####". A lista mistura nomes comuns, apelidos e
// handles com números/underscore pra os bots parecerem jogadores de verdade no
// lobby. `getRandomBotName(taken)` recebe os nomes JÁ em uso (o server passa os
// das salas ativas) pra não repetir nome simultaneamente — se por azar todos
// estiverem ocupados, anexa um número pra garantir unicidade.

export const BOT_NAMES: readonly string[] = [
  "felipe_mota",
  "carol92",
  "guerreiro_azul",
  "xablau2k",
  "jogador_top",
  "mestre_xadrez",
  "joao.pedro",
  "bia_souza",
  "lucas_ferreira",
  "rafa_oliveira",
  "gabis2",
  "thiagao",
  "matheus__",
  "ana.clara",
  "pedrinho07",
  "duda_costa",
  "vinizera",
  "leozin10",
  "marina_s",
  "brunão",
  "caio_ms",
  "larissa.r",
  "gustavo_h",
  "nando2000",
  "isa_lima",
  "rodrigo.pereira",
  "amandinha",
  "fernando_r",
  "ju_ramos",
  "kaique99",
  "renanzin",
  "talita_m",
  "diego_alves",
  "babi_rocha",
  "henrique_ssa",
  "naty.santos",
  "wesley_07",
  "sabrina_l",
  "otavinho",
  "camila_dias",
  "luanzera",
  "paty_oliveira",
  "joaozinho23",
  "estrela_negra",
  "ninja_br",
  "sombra_99",
  "rei_da_pista",
  "trovão",
  "furacao_az",
  "lobo_solitario",
  "dragao_vermelho",
  "fenix2k",
  "tati_ferraz",
  "gugu_lima",
  "dan_martins",
  "carlinhos.s",
  "vivi_andrade",
  "marcao_zl",
  "pri_gomes",
  "robertinho",
  "samuca",
  "yag00",
  "lele_costa",
  "tom_barros",
  "michele_r",
  "fabinho_07",
  "nubia_s",
  "alexz",
  "deborazinha",
  "igor_mendes",
  "kelvin22",
  "manu.alves",
  "rogerinho",
  "stefany_m",
  "vitin_br",
  "wallace_99",
  "yuri_costa",
  "ze_carlos",
  "agatha_l",
  "bernardo_h",
  "clara.mota",
  "douglas_ss",
  "edu_ramos",
  "flavinha",
  "guto_silva",
  "helena.r",
  "ivan_ml",
  "jess_oliveira",
  "kadu07",
  "luana_dias",
  "mari_clara",
  "neymar_fake",
  "pamela_s",
  "quel_rocha",
  "ruan_2k",
  "sandrinha",
  "tutu_lima",
];

// Retorna um nome aleatório que NÃO está em `taken`. Se todos os nomes da lista
// estiverem em uso, anexa um sufixo numérico ao escolhido pra garantir unicidade.
export const getRandomBotName = (taken?: ReadonlySet<string>): string => {
  if (!taken || taken.size === 0) {
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]!;
  }
  // Embaralha implícito: começa num índice aleatório e varre em ordem.
  const start = Math.floor(Math.random() * BOT_NAMES.length);
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const name = BOT_NAMES[(start + i) % BOT_NAMES.length]!;
    if (!taken.has(name)) return name;
  }
  // Todos ocupados (lobby gigante, improvável): garante unicidade com sufixo.
  const base = BOT_NAMES[start]!;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
};
