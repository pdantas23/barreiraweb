// === Cliente Supabase (singleton) ===
//
// Lê SUPABASE_URL e SUPABASE_SERVICE_KEY do .env. A service_role key
// bypassa RLS — então o server tem acesso total ao banco.
// Esse cliente NUNCA deve aparecer no mobile (a service key vazaria).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta a variável de ambiente ${name}. Confira o server/.env`,
    );
  }
  return value;
};

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_KEY"),
      {
        auth: {
          // Server não usa sessões de usuário — autentica via service_role key.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return client;
};
