import Cookies from 'js-cookie'
import { PLATFORM_STORAGE_KEYS, type ApiResponse } from '@hysp/ui-kit'

const TOKEN_KEY = PLATFORM_STORAGE_KEYS.COOKIE.TOKEN
let _apiBase = '/hycert-api'

/** Set the cert API base URL */
export function setCertApiBase(base: string) {
  if (base) _apiBase = base
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY) ?? Cookies.get(TOKEN_KEY) ?? null
}

async function certFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${_apiBase}${path}`, { ...init, headers })

  if (res.status === 401) {
    // Redirect to parent shell login
    if (typeof window !== 'undefined') {
      window.location.href = '/hyadmin/login'
    }
    throw new Error('Unauthorized')
  }

  const body = await res.json()
  if (!body.success) {
    throw new Error(body.error?.message ?? `Request failed`)
  }

  return body as ApiResponse<T>
}

// ── Utility API ─────────────────────────────────────────────────────────────

export interface VerifyRequest {
  certificate: string
  private_key?: string
  input_type?: string
  password?: string
  chain_input?: {
    intermediates?: string[]
    root?: string
    bundle?: string
  }
  options?: {
    check_ocsp?: boolean
    check_crl?: boolean
  }
}

export interface VerifyResponse {
  subject: { cn: string; o?: string; c?: string; ou?: string }
  issuer: { cn: string; o?: string }
  validity: { not_before: string; not_after: string; days_remaining: number; is_expired: boolean }
  sans: { dns: string[] | null; ip: string[] | null }
  key_info: { algorithm: string; bits: number }
  fingerprint: { sha256: string; sha1: string }
  checks: {
    key_pair_match: boolean | null
    chain_valid: boolean
    chain_complete: boolean
    root_trusted: boolean
    root_source?: string
  }
  chain: { index: number; role: string; cn: string; issuer_cn: string; source: string }[]
  warnings?: { code: string; message: string }[]
}

export interface ParseRequest {
  input: string
  input_type?: string
  password?: string
}

export interface ParseResponse {
  format: string
  certificates: {
    subject: { cn: string; o?: string }
    issuer: { cn: string; o?: string }
    serial_number: string
    validity: { not_before: string; not_after: string; days_remaining: number; is_expired: boolean }
    sans: { dns: string[] | null; ip: string[] | null }
    key_info: { algorithm: string; bits: number }
    signature_algorithm: string
    fingerprint: { sha256: string; sha1: string }
    is_ca: boolean
    role: string
  }[]
  has_private_key: boolean
}

export interface ConvertRequest {
  certificate: string
  private_key?: string
  input_type?: string
  input_password?: string
  target_format: string
  options?: {
    password?: string
    include_chain?: boolean
    friendly_name?: string
  }
}

export interface ConvertResponse {
  format: string
  content_base64: string
  filename_suggestion: string
  chain_included: boolean
  chain_nodes: number
}

export interface GenerateCSRRequest {
  domain: string
  sans?: string[]
  subject?: {
    o?: string
    ou?: string
    c?: string
    st?: string
    l?: string
  }
  key_type?: string
  key_bits?: number
}

export interface GenerateCSRResponse {
  csr_pem: string
  private_key_pem: string
  key_type: string
  key_bits: number
  warning: string
}

export interface MergeChainRequest {
  certificates: string[]
}

export interface MergeChainResponse {
  chain: { index: number; role: string; cn: string; issuer: string }[]
  pem: string
  count: number
}

export const certUtilityApi = {
  verify: (req: VerifyRequest) =>
    certFetch<VerifyResponse>('/api/v1/adm/cert/utility/verify', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  parse: (req: ParseRequest) =>
    certFetch<ParseResponse>('/api/v1/adm/cert/utility/parse', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  convert: (req: ConvertRequest) =>
    certFetch<ConvertResponse>('/api/v1/adm/cert/utility/convert', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  generateCSR: (req: GenerateCSRRequest) =>
    certFetch<GenerateCSRResponse>('/api/v1/adm/cert/utility/generate-csr', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  mergeChain: (req: MergeChainRequest) =>
    certFetch<MergeChainResponse>('/api/v1/adm/cert/utility/merge-chain', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}
