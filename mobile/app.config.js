const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const appJson = require("./app.json");

// Expoe vars do .env raiz via Constants.expoConfig.extra. Não dá pra usar
// process.env.EXPO_PUBLIC_* aqui porque Metro inlina essas vars em build-time
// lendo só de mobile/.env — o .env mora na raiz do monorepo.
module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      serverUrl:
        process.env.EXPO_PUBLIC_SERVER_URL ||
        process.env.VITE_SERVER_URL ||
        "http://localhost:3000",
      supabaseUrl: process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
};
