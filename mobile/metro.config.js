// Configuração do Metro pra rodar dentro de um monorepo npm-workspaces.
// Sem isso, Metro não enxerga `@barreira/shared` (que mora em ../shared)
// porque por default ele só procura node_modules de dentro do `mobile/`.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Inclui o repo inteiro no watch — assim o hot-reload reage quando
//    a gente mexe em arquivos de `shared/`.
config.watchFolders = [workspaceRoot];

// 2. Resolve node_modules tanto no projeto quanto na raiz do workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Hierarchical lookup off: o Metro às vezes "sobe" e acha cópias duplicadas
//    de libs. Desligar evita erros estranhos de "Invariant Violation:
//    Multiple copies of React".
config.resolver.disableHierarchicalLookup = true;

// 4. Nunca bundlar arquivos de teste (*.test / *.spec). Eles importam
//    @testing-library/react-native, que puxa módulos do Node (console, util)
//    que não existem no runtime RN — o que quebra o bundle. O Jest tem config
//    própria, então isso não afeta os testes.
const testFilesRE = /\.(test|spec)\.[jt]sx?$/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, testFilesRE)
  : testFilesRE;

module.exports = config;
