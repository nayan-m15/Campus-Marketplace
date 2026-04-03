import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sfsprtklywjrrlzhaela.supabase.co/'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmc3BydGtseXdqcnJsemhhZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDAxMDEsImV4cCI6MjA5MDgxNjEwMX0.9otmSE37nwTnnTQ-q0IGWz_s0JpvDuyWrkpWkRnTJh0'

export const supabase = createClient(supabaseUrl, supabaseKey)