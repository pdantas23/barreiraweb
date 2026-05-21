module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4: o plugin moveu pra react-native-worklets.
    // Tem que ser o ÚLTIMO plugin da lista (regra do reanimated).
    plugins: ["react-native-worklets/plugin"],
  };
};
