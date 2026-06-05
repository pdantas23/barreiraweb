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
    // Precisa ser true: o link de recuperacao de senha volta pra
    // /reset-password com os tokens no hash (#access_token=...&type=recovery).
    // O SDK so processa esse hash e emite PASSWORD_RECOVERY se isso estiver
    // ligado. Com false, ResetPassword nunca via a sessao e mostrava
    // "link expirado". (No mobile fica false de proposito: la os tokens
    // chegam via deep link e sao aplicados na mao com setSession.)
    detectSessionInUrl: true,
  },
});
