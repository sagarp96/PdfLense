import { createClient } from "@supabase/supabase-js";
declare global {
  interface ImportMetaEnv {
	VITE_SUPABASE_URL: string;
	VITE_SUPABASE_ANON_KEY: string;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
