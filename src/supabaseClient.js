import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const siteUrl = import.meta.env.VITE_SITE_URL

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    redirectTo: siteUrl,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})