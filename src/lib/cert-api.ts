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

/** Extract tenant code from JWT payload (claim "tc") */
function getTenantId(): string {
  const token = getToken()
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.tc ?? ''
  } catch {
    return ''
  }
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

/** certFetch with X-Tenant-ID header (for CRUD endpoints) */
async function crudFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const tenantId = getTenantId()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }
  if (tenantId) headers['X-Tenant-ID'] = tenantId
  return certFetch<T>(path, { ...init, headers })
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
  passphrase?: string
}

export interface GenerateCSRResponse {
  csr_pem: string
  private_key_pem: string
  key_type: string
  key_bits: number
  key_encrypted: boolean
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

export interface DecryptKeyRequest {
  encrypted_key: string
  password: string
}

export interface DecryptKeyResponse {
  private_key_pem: string
  key_type: string
  bits: number
}

// ── CRUD Types ──────────────────────────────────────────────────────────────

export interface CertificateDTO {
  id: number
  name: string
  common_name: string
  sans: string        // JSON array string
  serial_number: string
  issuer_cn: string
  not_before: string
  not_after: string
  key_algorithm: string
  fingerprint_sha256: string
  status: string      // active | expired | revoked
  source: string      // manual | csr | acme
  has_private_key: boolean
  key_encrypted: boolean
  csr_id: number | null
  tags: string        // JSON array string
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface CertListResponse {
  items: CertificateDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CertListParams {
  page?: number
  page_size?: number
  status?: string
  search?: string
  expire_in?: number
  sort_by?: string
  sort_dir?: string
}

export interface CertImportRequest {
  certificate: string
  private_key?: string
  input_type?: string
  password?: string
  name?: string
  tags?: string
  notes?: string
}

export interface CertImportResponse {
  certificate: CertificateDTO
  warnings?: { code: string; message: string }[]
}

export interface CertUpdateRequest {
  name?: string
  tags?: string
  notes?: string
}

export interface CertDownloadResponse {
  format: string
  content?: string         // for PEM
  content_base64?: string  // for binary formats
  filename: string
  chain_included?: boolean
}

export const certCrudApi = {
  import: (req: CertImportRequest) =>
    crudFetch<CertImportResponse>('/api/v1/adm/cert/certificates', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  list: (params: CertListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    if (params.expire_in) qs.set('expire_in', String(params.expire_in))
    if (params.sort_by) qs.set('sort_by', params.sort_by)
    if (params.sort_dir) qs.set('sort_dir', params.sort_dir)
    const q = qs.toString()
    return crudFetch<CertListResponse>(`/api/v1/adm/cert/certificates${q ? `?${q}` : ''}`)
  },

  get: (id: number) =>
    crudFetch<CertificateDTO>(`/api/v1/adm/cert/certificates/${id}`),

  update: (id: number, req: CertUpdateRequest) =>
    crudFetch<CertificateDTO>(`/api/v1/adm/cert/certificates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),

  delete: (id: number) =>
    crudFetch<{ message: string }>(`/api/v1/adm/cert/certificates/${id}`, {
      method: 'DELETE',
    }),

  uploadKey: (id: number, privateKey: string, password?: string) =>
    crudFetch<CertificateDTO>(`/api/v1/adm/cert/certificates/${id}/key`, {
      method: 'PUT',
      body: JSON.stringify({ private_key: privateKey, password: password || undefined }),
    }),

  download: (id: number, format = 'pem', opts?: { password?: string; includeKey?: boolean }) => {
    const qs = new URLSearchParams({ format })
    if (opts?.password) qs.set('password', opts.password)
    if (opts?.includeKey) qs.set('include_key', 'true')
    return crudFetch<CertDownloadResponse>(`/api/v1/adm/cert/certificates/${id}/download?${qs}`)
  },
}

// ── CSR Types ───────────────────────────────────────────────────────────────

export interface CSRDTO {
  id: number
  common_name: string
  sans: string          // JSON array string
  subject: string       // JSON object string {o, ou, c, st, l}
  key_algorithm: string
  key_bits: number
  has_private_key: boolean
  status: string        // pending | signed
  certificate_id: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CSRListResponse {
  items: CSRDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CSRListParams {
  page?: number
  page_size?: number
  status?: string
  search?: string
}

export interface CreateCSRRequest {
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

export interface CSRDownloadResponse {
  format: string
  content: string
  filename: string
}

export const csrCrudApi = {
  generate: (req: CreateCSRRequest) =>
    crudFetch<CSRDTO>('/api/v1/adm/cert/csrs', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  list: (params: CSRListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    const q = qs.toString()
    return crudFetch<CSRListResponse>(`/api/v1/adm/cert/csrs${q ? `?${q}` : ''}`)
  },

  get: (id: number) =>
    crudFetch<CSRDTO>(`/api/v1/adm/cert/csrs/${id}`),

  delete: (id: number) =>
    crudFetch<{ message: string }>(`/api/v1/adm/cert/csrs/${id}`, {
      method: 'DELETE',
    }),

  download: (id: number) =>
    crudFetch<CSRDownloadResponse>(`/api/v1/adm/cert/csrs/${id}/download`),
}

// ── Deployment Types ────────────────────────────────────────────────────────

export interface DeploymentDTO {
  id: number
  certificate_id: number
  target_host: string
  target_service: string  // nginx | apache | tomcat | k8s | haproxy | iis | other
  target_detail: string
  port: number | null
  status: string          // active | removed
  deploy_status: string   // pending | deploying | deployed | failed
  last_fingerprint: string
  last_deployed_at: string | null
  agent_token_id: number | null
  agent_id: string | null
  deployed_at: string | null
  deployed_by: string
  notes: string
  created_at: string
  updated_at: string
}

// ── Deployment History Types ────────────────────────────────────────────────

export interface DeploymentHistoryItem {
  id: number
  deployment_id: number
  certificate_id: number
  agent_token_id: number | null
  fingerprint: string
  action: string        // deploy | rollback | verify
  status: string        // success | failed
  error_message?: string
  duration_ms?: number
  deployed_at: string
  created_at: string
}

export interface DeploymentHistoryResponse {
  items: DeploymentHistoryItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DeploymentListResponse {
  items: DeploymentDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DeploymentListParams {
  page?: number
  page_size?: number
  certificate_id?: number
  search?: string
  status?: string
  deploy_status?: string
}

export interface CreateDeploymentRequest {
  certificate_id: number
  target_host: string
  target_service: string
  target_detail?: string
  port?: number
  notes?: string
  agent_id?: string
}

export interface UpdateDeploymentRequest {
  target_host?: string
  target_service?: string
  target_detail?: string
  port?: number
  status?: string
  notes?: string
  agent_id?: string
}

// ── Agent Registration Types ────────────────────────────────────────────────

export interface AgentRegistrationDTO {
  id: number
  agent_id: string
  agent_token_id: number
  name: string
  hostname: string
  ip_addresses: string  // JSON array
  os: string
  version: string
  poll_interval: number  // seconds
  status: string
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface AgentRegistrationListResponse {
  items: AgentRegistrationDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export const agentRegistrationApi = {
  list: (params?: { page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    const q = qs.toString()
    return crudFetch<AgentRegistrationListResponse>(`/api/v1/adm/cert/agent-registrations${q ? `?${q}` : ''}`)
  },
}

export const deployCrudApi = {
  create: (req: CreateDeploymentRequest) =>
    crudFetch<DeploymentDTO>('/api/v1/adm/cert/deployments', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  list: (params: DeploymentListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.page_size) qs.set('page_size', String(params.page_size))
    if (params.certificate_id) qs.set('certificate_id', String(params.certificate_id))
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    if (params.deploy_status) qs.set('deploy_status', params.deploy_status)
    const q = qs.toString()
    return crudFetch<DeploymentListResponse>(`/api/v1/adm/cert/deployments${q ? `?${q}` : ''}`)
  },

  get: (id: number) =>
    crudFetch<DeploymentDTO>(`/api/v1/adm/cert/deployments/${id}`),

  update: (id: number, req: UpdateDeploymentRequest) =>
    crudFetch<DeploymentDTO>(`/api/v1/adm/cert/deployments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),

  delete: (id: number) =>
    crudFetch<{ message: string }>(`/api/v1/adm/cert/deployments/${id}`, {
      method: 'DELETE',
    }),

  history: (id: number, params?: { page?: number; page_size?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.page_size) qs.set('page_size', String(params.page_size))
    const q = qs.toString()
    return crudFetch<DeploymentHistoryResponse>(`/api/v1/adm/cert/deployments/${id}/history${q ? `?${q}` : ''}`)
  },
}

// ── Utility API ─────────────────────────────────────────────────────────────

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

  decryptKey: (req: DecryptKeyRequest) =>
    certFetch<DecryptKeyResponse>('/api/v1/adm/cert/utility/decrypt-key', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  mergeChain: (req: MergeChainRequest) =>
    certFetch<MergeChainResponse>('/api/v1/adm/cert/utility/merge-chain', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}
