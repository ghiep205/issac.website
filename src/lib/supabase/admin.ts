import { createClient } from '@supabase/supabase-js'

export function hasSupabaseConfig(): boolean {
  if (typeof process === 'undefined') return false
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return Boolean(supabaseUrl && !supabaseUrl.includes('placeholder.supabase.co'))
}

export function hasGenuineServiceRoleKey(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
  if (!serviceKey) return false

  // Support Supabase's newer non-JWT secret API keys (sb_secret_...)
  if (serviceKey.startsWith('sb_secret_') && serviceKey.length > 20) {
    return true
  }

  let expectedRef = ''
  try {
    const hostname = new URL(supabaseUrl).hostname
    expectedRef = hostname.split('.')[0]
  } catch {}

  if (serviceKey.length > 50) {
    try {
      const parts = serviceKey.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
        // Ignore demo keys, require service_role claim or matching project ref
        if (
          payload.iss !== 'supabase-demo' &&
          (payload.role === 'service_role' || !payload.role) &&
          (!expectedRef || !payload.ref || payload.ref === expectedRef)
        ) {
          return true
        }
      }
    } catch {}
  }

  return false
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  const activeKey = hasGenuineServiceRoleKey() ? serviceKey : anonKey

  return createClient(supabaseUrl, activeKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

