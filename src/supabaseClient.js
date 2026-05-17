import { createClient } from '@supabase/supabase-js'
import { getAppBaseUrl } from './utils/appUrl'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY
const authRedirectUrl = getAppBaseUrl()
const fallbackSupabaseUrl = 'https://example.supabase.co'
const fallbackSupabaseKey = 'missing-supabase-anon-key'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = createClient(supabaseUrl || fallbackSupabaseUrl, supabaseKey || fallbackSupabaseKey, {
  auth: {
    redirectTo: authRedirectUrl,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
