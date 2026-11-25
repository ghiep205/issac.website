import { createClient } from '@supabase/supabase-js'

function cleanEnvValue(value?: string): string {
  const trimmed = (value || '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function getSupabaseUrl(): string {
  return cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)
}

function getSupabaseServiceKey(): string {
  return cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
}

function getSupabaseAnonKey(): string {
  return cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
}

export function hasSupabaseConfig(): boolean {
  if (typeof process === 'undefined') return false
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false
  const supabaseUrl = getSupabaseUrl()
  return Boolean(supabaseUrl && !supabaseUrl.includes('placeholder.supabase.co'))
}

export function hasGenuineServiceRoleKey(): boolean {
  const supabaseUrl = getSupabaseUrl() || 'https://placeholder.supabase.co'
  const serviceKey = getSupabaseServiceKey()
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
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
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
  const supabaseUrl = getSupabaseUrl() || 'https://placeholder.supabase.co'
  const serviceKey = getSupabaseServiceKey()
  const anonKey = getSupabaseAnonKey() || 'placeholder-key'

  const activeKey = hasGenuineServiceRoleKey() ? serviceKey : anonKey

  return createClient(supabaseUrl, activeKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

