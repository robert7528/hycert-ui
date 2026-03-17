'use client'

import { useState, useRef, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Button, Textarea, Input, Label, Badge,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Separator,
} from '@hysp/ui-kit'
import { Loader2, ShieldCheck, FileSearch, ArrowRightLeft, FileKey, Upload, Download } from 'lucide-react'
import { certUtilityApi, type VerifyResponse, type ParseResponse, type ConvertResponse, type GenerateCSRResponse } from '@/lib/cert-api'

type Tool = 'verify' | 'parse' | 'convert' | 'generate-csr'

const CERT_ACCEPT = '.pem,.cer,.crt,.der,.pfx,.p12,.jks,.p7b,.key,.csr'
const BINARY_EXTS = ['.pfx', '.p12', '.der', '.cer', '.jks', '.p7b']

function isBinaryFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return BINARY_EXTS.some((ext) => lower.endsWith(ext))
}

function detectInputType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pfx') || lower.endsWith('.p12')) return 'pfx_base64'
  if (lower.endsWith('.der')) return 'der_base64'
  // .cer could be DER or PEM — check content later, default to auto
  return ''
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:...;base64," prefix
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface FileUploadResult {
  content: string
  filename: string
  inputType: string // '' for text, 'pfx_base64' or 'der_base64' for binary
}

function FileUploadButton({ onLoad, accept, label }: { onLoad: (result: FileUploadResult) => void; accept?: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const binary = isBinaryFile(file.name)
    const content = binary ? await readFileAsBase64(file) : await readFileAsText(file)
    const inputType = binary ? detectInputType(file.name) : ''
    onLoad({ content, filename: file.name, inputType })
    if (inputRef.current) inputRef.current.value = ''
  }, [onLoad])

  return (
    <>
      <input ref={inputRef} type="file" accept={accept ?? CERT_ACCEPT} onChange={handleChange} className="hidden" />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        {label}
      </Button>
    </>
  )
}

export function CertToolbox() {
  const { t } = useLocale()
  const [activeTool, setActiveTool] = useState<Tool>('verify')
  const { toolbox } = t.hycert
  const { verify, parse, convert, generateCsr } = toolbox

  const tools: { key: Tool; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: 'verify', icon: <ShieldCheck className="h-4 w-4" />, label: verify.title, desc: verify.description },
    { key: 'parse', icon: <FileSearch className="h-4 w-4" />, label: parse.title, desc: parse.description },
    { key: 'convert', icon: <ArrowRightLeft className="h-4 w-4" />, label: convert.title, desc: convert.description },
    { key: 'generate-csr', icon: <FileKey className="h-4 w-4" />, label: generateCsr.title, desc: generateCsr.description },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {tools.map((tool) => (
          <Button
            key={tool.key}
            variant={activeTool === tool.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(tool.key)}
            className="gap-1.5"
          >
            {tool.icon}
            {tool.label}
          </Button>
        ))}
      </div>
      <Separator />
      {activeTool === 'verify' && <VerifyTool />}
      {activeTool === 'parse' && <ParseTool />}
      {activeTool === 'convert' && <ConvertTool />}
      {activeTool === 'generate-csr' && <GenerateCSRTool />}
    </div>
  )
}

// ── Verify ────────────────────────────────────────────────────────────────────

function VerifyTool() {
  const { t } = useLocale()
  const { common, verify, result: res } = t.hycert.toolbox
  const [cert, setCert] = useState('')
  const [inputType, setInputType] = useState('')
  const [password, setPassword] = useState('')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VerifyResponse | null>(null)

  const isPfx = inputType === 'pfx_base64'
  const isBinary = inputType === 'pfx_base64' || inputType === 'der_base64'

  const handleFileUpload = (r: FileUploadResult) => {
    setCert(r.content)
    setInputType(r.inputType)
    setUploadedFilename(r.filename)
    if (!r.inputType) setPassword('')
  }

  const handleVerify = async () => {
    if (!cert.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiRes = await certUtilityApi.verify({
        certificate: cert,
        private_key: privateKey || undefined,
        input_type: inputType || undefined,
        password: password || undefined,
      })
      setResult(apiRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{verify.title}</CardTitle>
          <CardDescription>{verify.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{common.labelCertificate}</Label>
              <FileUploadButton label={common.buttonUpload} onLoad={handleFileUpload} />
            </div>
            {isBinary && uploadedFilename ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground font-mono">{uploadedFilename}</div>
            ) : (
              <Textarea
                rows={10}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={cert}
                onChange={(e) => { setCert(e.target.value); setInputType(''); setUploadedFilename('') }}
                className="font-mono text-xs"
              />
            )}
          </div>
          {isPfx && (
            <div className="space-y-1.5">
              <Label>{common.labelPfxPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={common.placeholderPfxPassword}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{common.labelPrivateKey}</Label>
              <FileUploadButton accept=".key,.pem" label={common.buttonUpload} onLoad={(r) => setPrivateKey(r.content)} />
            </div>
            <Textarea
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button onClick={handleVerify} disabled={loading || !cert.trim()} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {verify.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section title={res.subject}>
              <Row label="CN" value={result.subject.cn} />
              {result.subject.o && <Row label="O" value={result.subject.o} />}
            </Section>
            <Section title={res.validity}>
              <Row label={res.notBefore} value={result.validity.not_before} />
              <Row label={res.notAfter} value={result.validity.not_after} />
              <Row
                label={res.daysRemaining}
                value={
                  <Badge variant={result.validity.is_expired ? 'destructive' : result.validity.days_remaining < 30 ? 'secondary' : 'default'}>
                    {result.validity.is_expired ? res.expired : `${result.validity.days_remaining} ${res.days}`}
                  </Badge>
                }
              />
            </Section>
            <Section title="SANs">
              {result.sans.dns?.length ? (
                <div className="flex flex-wrap gap-1">
                  {result.sans.dns.map((d) => (
                    <Badge key={d} variant="outline" className="font-mono text-xs">{d}</Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">{res.none}</span>
              )}
            </Section>
            <Section title={res.keyInfo}>
              <Row label={res.algorithm} value={result.key_info.algorithm} />
              <Row label={res.bits} value={String(result.key_info.bits)} />
            </Section>
            <Section title={res.chainStatus}>
              <Row label={res.chainValid} value={<StatusBadge ok={result.checks.chain_valid} />} />
              <Row label={res.chainComplete} value={<StatusBadge ok={result.checks.chain_complete} />} />
              <Row label={res.rootTrusted} value={<StatusBadge ok={result.checks.root_trusted} />} />
              {result.checks.key_pair_match !== null && (
                <Row label={res.keyMatch} value={<StatusBadge ok={result.checks.key_pair_match} />} />
              )}
            </Section>
            {result.chain.length > 0 && (
              <Section title={res.chainDetail}>
                {result.chain.map((node) => (
                  <div key={node.index} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="shrink-0">{node.role}</Badge>
                    <span className="font-mono truncate">{node.cn}</span>
                    <span className="text-muted-foreground shrink-0">({node.source})</span>
                  </div>
                ))}
              </Section>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <Section title={res.warnings}>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-yellow-600 dark:text-yellow-400 text-xs">{w.code}: {w.message}</p>
                ))}
              </Section>
            )}
            <Section title={res.fingerprint}>
              <Row label="SHA-256" value={<span className="font-mono text-xs break-all">{result.fingerprint.sha256}</span>} />
              <Row label="SHA-1" value={<span className="font-mono text-xs break-all">{result.fingerprint.sha1}</span>} />
            </Section>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Parse ─────────────────────────────────────────────────────────────────────

function ParseTool() {
  const { t } = useLocale()
  const { common, parse, result: res } = t.hycert.toolbox
  const [input, setInput] = useState('')
  const [inputType, setInputType] = useState('')
  const [password, setPassword] = useState('')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ParseResponse | null>(null)

  const isPfx = inputType === 'pfx_base64'

  const handleFileUpload = (r: FileUploadResult) => {
    setInput(r.content)
    setInputType(r.inputType)
    setUploadedFilename(r.filename)
    if (!r.inputType) setPassword('')
  }

  const handleParse = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiRes = await certUtilityApi.parse({
        input,
        input_type: inputType || undefined,
        password: password || undefined,
      })
      setResult(apiRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{parse.title}</CardTitle>
          <CardDescription>{parse.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{common.labelCertificate}</Label>
              <FileUploadButton label={common.buttonUpload} onLoad={handleFileUpload} />
            </div>
            {isPfx && uploadedFilename ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground font-mono">{uploadedFilename}</div>
            ) : (
              <Textarea
                rows={12}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={input}
                onChange={(e) => { setInput(e.target.value); setInputType(''); setUploadedFilename('') }}
                className="font-mono text-xs"
              />
            )}
          </div>
          {isPfx && (
            <div className="space-y-1.5">
              <Label>{common.labelPfxPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={common.placeholderPfxPassword}
              />
            </div>
          )}
          <Button onClick={handleParse} disabled={loading || !input.trim()} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {parse.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
            <CardDescription>
              {res.format}: {result.format}
              {result.has_private_key && <Badge variant="secondary" className="ml-2">{res.hasPrivateKey}</Badge>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {result.certificates.map((cert, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{cert.role}</Badge>
                  <span className="font-medium">{cert.subject.cn}</span>
                  {cert.is_ca && <Badge variant="secondary">CA</Badge>}
                </div>
                <Row label={res.issuer} value={cert.issuer.cn} />
                <Row label={res.serial} value={<span className="font-mono text-xs">{cert.serial_number}</span>} />
                <Row label={res.notAfter} value={cert.validity.not_after} />
                <Row
                  label={res.daysRemaining}
                  value={
                    <Badge variant={cert.validity.is_expired ? 'destructive' : cert.validity.days_remaining < 30 ? 'secondary' : 'default'}>
                      {cert.validity.is_expired ? res.expired : `${cert.validity.days_remaining} ${res.days}`}
                    </Badge>
                  }
                />
                <Row label={res.algorithm} value={`${cert.key_info.algorithm} ${cert.key_info.bits}-bit`} />
                {cert.sans.dns?.length ? (
                  <div>
                    <span className="text-muted-foreground">SANs: </span>
                    <span className="font-mono text-xs">{cert.sans.dns.join(', ')}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Convert ───────────────────────────────────────────────────────────────────

function ConvertTool() {
  const { t } = useLocale()
  const { common, convert, result: res } = t.hycert.toolbox
  const [cert, setCert] = useState('')
  const [inputType, setInputType] = useState('')
  const [inputPassword, setInputPassword] = useState('')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [targetFormat, setTargetFormat] = useState('der')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ConvertResponse | null>(null)

  const isInputPfx = inputType === 'pfx_base64'
  const isInputBinary = inputType === 'pfx_base64' || inputType === 'der_base64'
  const needsOutputPassword = targetFormat === 'pfx' || targetFormat === 'jks'

  const handleFileUpload = (r: FileUploadResult) => {
    setCert(r.content)
    setInputType(r.inputType)
    setUploadedFilename(r.filename)
    if (!r.inputType) setInputPassword('')
  }

  const handleConvert = async () => {
    if (!cert.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiRes = await certUtilityApi.convert({
        certificate: cert,
        private_key: privateKey || undefined,
        input_type: inputType || undefined,
        input_password: inputPassword || undefined,
        target_format: targetFormat,
        options: password ? { password } : undefined,
      })
      setResult(apiRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const binary = atob(result.content_base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename_suggestion
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{convert.title}</CardTitle>
          <CardDescription>{convert.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{common.labelCertificate}</Label>
              <FileUploadButton label={common.buttonUpload} onLoad={handleFileUpload} />
            </div>
            {isInputBinary && uploadedFilename ? (
              <div className="rounded-md border p-3 text-sm text-muted-foreground font-mono">{uploadedFilename}</div>
            ) : (
              <Textarea
                rows={8}
                placeholder="-----BEGIN CERTIFICATE-----"
                value={cert}
                onChange={(e) => { setCert(e.target.value); setInputType(''); setUploadedFilename('') }}
                className="font-mono text-xs"
              />
            )}
          </div>
          {isInputPfx && (
            <div className="space-y-1.5">
              <Label>{common.labelInputPfxPassword}</Label>
              <Input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder={common.placeholderPfxPassword}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{common.labelPrivateKey}</Label>
              <FileUploadButton accept=".key,.pem" label={common.buttonUpload} onLoad={(r) => setPrivateKey(r.content)} />
            </div>
            <Textarea
              rows={4}
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{convert.labelTargetFormat}</Label>
            <Select value={targetFormat} onValueChange={setTargetFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pem">PEM (.pem)</SelectItem>
                <SelectItem value="der">DER (.der/.cer)</SelectItem>
                <SelectItem value="pfx">PFX / PKCS#12 (.pfx)</SelectItem>
                <SelectItem value="jks">JKS (.jks)</SelectItem>
                <SelectItem value="p7b">P7B / PKCS#7 (.p7b)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {targetFormat === 'p7b' && (
            <p className="text-xs text-muted-foreground">{convert.hintP7bNoKey}</p>
          )}
          {needsOutputPassword && (
            <div className="space-y-1.5">
              <Label>{common.labelOutputPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={common.placeholderPfxPassword}
              />
            </div>
          )}
          <Button onClick={handleConvert} disabled={loading || !cert.trim()} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {convert.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={res.format} value={result.format} />
            <Row label={convert.labelFilename} value={result.filename_suggestion} />
            <Row label={convert.labelChainIncluded} value={result.chain_included ? convert.yes : convert.no} />
            <Button variant="outline" onClick={handleDownload} className="w-full gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {common.buttonDownload}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Generate CSR ──────────────────────────────────────────────────────────────

function GenerateCSRTool() {
  const { t } = useLocale()
  const { common, generateCsr, result: res } = t.hycert.toolbox
  const [domain, setDomain] = useState('')
  const [sans, setSans] = useState('')
  const [org, setOrg] = useState('')
  const [country, setCountry] = useState('')
  const [keyType, setKeyType] = useState('rsa')
  const [keyBits, setKeyBits] = useState('2048')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateCSRResponse | null>(null)

  const handleGenerate = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const sansList = sans.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
      const apiRes = await certUtilityApi.generateCSR({
        domain,
        sans: sansList.length ? sansList : undefined,
        subject: (org || country) ? { o: org || undefined, c: country || undefined } : undefined,
        key_type: keyType,
        key_bits: parseInt(keyBits),
      })
      setResult(apiRes.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{generateCsr.title}</CardTitle>
          <CardDescription>{generateCsr.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{generateCsr.labelDomain} *</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{generateCsr.labelSans}</Label>
            <Textarea
              rows={3}
              value={sans}
              onChange={(e) => setSans(e.target.value)}
              placeholder={"www.example.com\napi.example.com"}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{generateCsr.labelOrganization}</Label>
              <Input value={org} onChange={(e) => setOrg(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{generateCsr.labelCountry}</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="TW" maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{generateCsr.labelKeyType}</Label>
              <Select value={keyType} onValueChange={setKeyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rsa">RSA</SelectItem>
                  <SelectItem value="ec">EC (ECDSA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{generateCsr.labelKeySize}</Label>
              <Select value={keyBits} onValueChange={setKeyBits}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {keyType === 'rsa' ? (
                    <>
                      <SelectItem value="2048">2048-bit</SelectItem>
                      <SelectItem value="4096">4096-bit</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="256">P-256</SelectItem>
                      <SelectItem value="384">P-384</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading || !domain.trim()} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {generateCsr.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
            <CardDescription>
              {result.key_type.toUpperCase()} {result.key_bits}-bit
              {result.warning && <span className="text-yellow-600 dark:text-yellow-400 ml-2">{result.warning}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>CSR (PEM)</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.csr_pem)}>
                    {common.buttonCopy}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadTextFile(result.csr_pem, `${domain || 'certificate'}.csr`)} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    .csr
                  </Button>
                </div>
              </div>
              <Textarea readOnly rows={8} value={result.csr_pem} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{common.labelPrivateKeyFull}</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result.private_key_pem)}>
                    {common.buttonCopy}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadTextFile(result.private_key_pem, `${domain || 'certificate'}.key`)} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    .key
                  </Button>
                </div>
              </div>
              <Textarea readOnly rows={8} value={result.private_key_pem} className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0 min-w-[80px]">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function StatusBadge({ ok }: { ok: boolean }) {
  return <Badge variant={ok ? 'default' : 'destructive'}>{ok ? 'OK' : 'FAIL'}</Badge>
}
