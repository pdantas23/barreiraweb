// Cliente Supabase nativo (mobile).
//
// Espelha web/src/net/supabase.ts mas com persistência via AsyncStorage
// (não tem window.localStorage no RN). O Supabase Auth cuida sozinho de:
//  - guardar sessão JSON-serializada em AsyncStorage
//  - refresh automático do JWT em background
//  - emitir eventos em onAuthStateChange
//
// SUPABASE_URL / ANON_KEY vêm de Constants.expoConfig.extra (populado pelo
// app.config.js lendo o .env da raiz). Iguais aos da web — mesmo projeto.

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const SUPABASE_URL =
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? "";
const SUPABASE_ANON_KEY =
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltam supabaseUrl/supabaseAnonKey no extra do app.config.js. " +
      "Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env da raiz.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Deep link traz tokens manualmente via setSession() — não tem URL pra
    // o SDK detectar sozinho como no web.
    detectSessionInUrl: false,
  },
});
