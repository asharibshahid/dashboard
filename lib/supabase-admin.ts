import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server-side admin client.");
}

if (!url) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for server-side admin client.");
}

export const sbAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
