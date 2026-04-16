import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY
const siteUrl = import.meta.env.VITE_SITE_URL

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_KEY).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    redirectTo: siteUrl,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
