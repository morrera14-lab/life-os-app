// Supabase client — copied from the Faith Apps (WordApp-Expo/lib/supabase.js) pattern:
// guarded construction so missing env vars degrade to a stub instead of crashing at import.
// Project: life-os-app (tvnvijvuuwfbgwnzrrgn) — SEPARATE from Faith Apps' WordApp project
// per Decision 2026-05-28. Schema: see vault Projects/life-os-app/scripts/migrations/.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
