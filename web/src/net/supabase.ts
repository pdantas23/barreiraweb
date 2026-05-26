// === Cliente Supabase (singleton, frontend) ===
//
// Usa a anon key (publica). O Supabase Auth cuida sozinho de:
//  - persistir sessao no localStorage
//  - refresh automatico do JWT
//  - emitir eventos em onAuthStateChange
//
// A service_role key NUNCA aparece aqui - so no server (.env do VPS).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY no .env da raiz do monorepo",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
