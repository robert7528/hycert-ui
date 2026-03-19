'use client'

import { useState, useRef, useCallback } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Button, Textarea, Input, Label, Badge,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Separator,
} from '@hysp/ui-kit'
import { Loader2, ShieldCheck, FileSearch, ArrowRightLeft, FileKey, Link2, KeyRound, Upload, Download, X } from 'lucide-react'
import { certUtilityApi, type VerifyResponse, type ParseResponse, type ConvertResponse, type GenerateCSRResponse, type MergeChainResponse, type DecryptKeyResponse } from '@/lib/cert-api'
import { toast } from '@hysp/ui-kit'

type Tool = 'verify' | 'parse' | 'convert' | 'merge-chain' | 'decrypt-key' | 'generate-csr'

const CERT_ACCEPT = '.pem,.cer,.crt,.der,.pfx,.p12,.jks,.p7b,.key,.csr'
const BINARY_EXTS = ['.pfx', '.p12', '.der', '.jks', '.p7b']

function isBinaryExt(filename: string): boolean {
  const lower = filename.toLowerCase()
  return BINARY_EXTS.some((ext) => lower.endsWith(ext))
}

function isAmbiguousExt(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower.endsWith('.cer') || lower.endsWith('.crt')
}

function detectInputType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pfx') || lower.endsWith('.p12')) return 'pfx_base64'
  if (lower.endsWith('.der')) return 'der_base64'
  if (lower.endsWith('.jks')) return 'jks_base64'
  if (lower.endsWith('.p7b')) return 'p7b_base64'
  return ''
}

async function readFileSmartly(file: File): Promise<{ content: string; inputType: string }> {
  // .cer/.crt can be PEM or DER — peek at content to decide
  if (isAmbiguousExt(file.name)) {
    const text = await readFileAsText(file)
    if (text.trimStart().startsWith('-----BEGIN ')) {
      return { content: text, inputType: '' }
    }
    // Not PEM → treat as binary DER
    const base64 = await readFileAsBase64(file)
    return { content: base64, inputType: 'der_base64' }
  }

  if (isBinaryExt(file.name)) {
    const base64 = await readFileAsBase64(file)
    return { content: base64, inputType: detectInputType(file.name) }
  }

  // Text formats: .pem, .key, .csr
  const text = await readFileAsText(file)
  return { content: text, inputType: '' }
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
    const { content, inputType } = await readFileSmartly(file)
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
  const { verify, parse, convert, mergeChain, decryptKey, generateCsr } = toolbox

  const tools: { key: Tool; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: 'verify', icon: <ShieldCheck className="h-4 w-4" />, label: verify.title, desc: verify.description },
    { key: 'parse', icon: <FileSearch className="h-4 w-4" />, label: parse.title, desc: parse.description },
    { key: 'convert', icon: <ArrowRightLeft className="h-4 w-4" />, label: convert.title, desc: convert.description },
    { key: 'merge-chain', icon: <Link2 className="h-4 w-4" />, label: mergeChain.title, desc: mergeChain.description },
    { key: 'decrypt-key', icon: <KeyRound className="h-4 w-4" />, label: decryptKey.title, desc: decryptKey.description },
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
      {activeTool === 'merge-chain' && <MergeChainTool />}
      {activeTool === 'decrypt-key' && <DecryptKeyTool />}
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

  const needsPassword = inputType === 'pfx_base64' || inputType === 'jks_base64'
  const isBinary = inputType === 'pfx_base64' || inputType === 'der_base64' || inputType === 'jks_base64' || inputType === 'p7b_base64'

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
          {needsPassword && (
            <div className="space-y-1.5">
              <Label>{common.labelPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={common.placeholderPassword}
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

  const needsPassword = inputType === 'pfx_base64' || inputType === 'jks_base64'
  const isBinary = inputType === 'pfx_base64' || inputType === 'der_base64' || inputType === 'jks_base64' || inputType === 'p7b_base64'

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
            {isBinary && uploadedFilename ? (
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
          {needsPassword && (
            <div className="space-y-1.5">
              <Label>{common.labelPassword}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={common.placeholderPassword}
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

  const isInputNeedsPassword = inputType === 'pfx_base64' || inputType === 'jks_base64'
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
          {isInputNeedsPassword && (
            <div className="space-y-1.5">
              <Label>{common.labelInputPassword}</Label>
              <Input
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder={common.placeholderPassword}
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
                placeholder={common.placeholderPassword}
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

// ── Merge Chain ──────────────────────────────────────────────────────────

function MultiFileUploadButton({ onLoad, accept, label }: { onLoad: (results: FileUploadResult[]) => void; accept?: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const results: FileUploadResult[] = []
    for (const file of Array.from(files)) {
      const { content, inputType } = await readFileSmartly(file)
      results.push({ content, filename: file.name, inputType })
    }
    onLoad(results)
    if (inputRef.current) inputRef.current.value = ''
  }, [onLoad])

  return (
    <>
      <input ref={inputRef} type="file" accept={accept ?? '.pem,.cer,.crt'} multiple onChange={handleChange} className="hidden" />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
        <Upload className="h-3.5 w-3.5" />
        {label}
      </Button>
    </>
  )
}

function MergeChainTool() {
  const { t } = useLocale()
  const { common, mergeChain, result: res } = t.hycert.toolbox
  const [certs, setCerts] = useState<{ filename: string; content: string }[]>([])
  const [pasteInput, setPasteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<MergeChainResponse | null>(null)

  const handleFilesUploaded = (results: FileUploadResult[]) => {
    setCerts((prev) => [
      ...prev,
      ...results.map((r) => ({ filename: r.filename, content: r.content })),
    ])
    setResult(null)
  }

  const handleAddPaste = () => {
    if (!pasteInput.trim()) return
    setCerts((prev) => [...prev, { filename: `pasted-${prev.length + 1}.pem`, content: pasteInput.trim() }])
    setPasteInput('')
    setResult(null)
  }

  const handleRemove = (index: number) => {
    setCerts((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
  }

  const handleMerge = async () => {
    if (certs.length < 2) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiRes = await certUtilityApi.mergeChain({
        certificates: certs.map((c) => c.content),
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
          <CardTitle className="text-base">{mergeChain.title}</CardTitle>
          <CardDescription>{mergeChain.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{mergeChain.labelCerts}</Label>
            <MultiFileUploadButton label={mergeChain.buttonAddFile} onLoad={handleFilesUploaded} />
          </div>

          {certs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{mergeChain.emptyHint}</p>
          ) : (
            <div className="space-y-1">
              {certs.map((cert, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                  <span className="font-mono text-xs truncate">{cert.filename}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemove(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          <div className="space-y-1.5">
            <Label>{mergeChain.labelOrPaste}</Label>
            <Textarea
              rows={4}
              placeholder="-----BEGIN CERTIFICATE-----"
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleAddPaste} disabled={!pasteInput.trim()}>
              {mergeChain.buttonAdd}
            </Button>
          </div>

          <Button onClick={handleMerge} disabled={loading || certs.length < 2} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {mergeChain.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
            <CardDescription>
              {mergeChain.resultCount.replace('{count}', String(result.count))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section title={mergeChain.resultChainOrder}>
              {result.chain.map((node) => (
                <div key={node.index} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0">{node.index + 1}</Badge>
                  <Badge variant="secondary" className="shrink-0">{node.role}</Badge>
                  <span className="font-mono truncate">{node.cn}</span>
                </div>
              ))}
            </Section>
            <Separator />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>fullchain.pem</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result.pem); toast.success(t.hycert.toolbox.common.toastCopied) }}>
                    {common.buttonCopy}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadTextFile(result.pem, 'fullchain.pem')} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    {common.buttonDownload}
                  </Button>
                </div>
              </div>
              <Textarea readOnly rows={10} value={result.pem} className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Decrypt Key ──────────────────────────────────────────────────────────

function DecryptKeyTool() {
  const { t } = useLocale()
  const { common, decryptKey, result: res } = t.hycert.toolbox
  const [encryptedKey, setEncryptedKey] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DecryptKeyResponse | null>(null)

  const handleFileUpload = (r: FileUploadResult) => {
    setEncryptedKey(r.content)
    setResult(null)
  }

  const handleDecrypt = async () => {
    if (!encryptedKey.trim() || !password) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const apiRes = await certUtilityApi.decryptKey({
        encrypted_key: encryptedKey,
        password,
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
          <CardTitle className="text-base">{decryptKey.title}</CardTitle>
          <CardDescription>{decryptKey.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{decryptKey.labelEncryptedKey}</Label>
              <FileUploadButton accept=".key,.pem" label={common.buttonUpload} onLoad={handleFileUpload} />
            </div>
            <Textarea
              rows={10}
              placeholder="-----BEGIN ENCRYPTED PRIVATE KEY-----"
              value={encryptedKey}
              onChange={(e) => { setEncryptedKey(e.target.value); setResult(null) }}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{decryptKey.labelPassword}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button onClick={handleDecrypt} disabled={loading || !encryptedKey.trim() || !password} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {decryptKey.buttonRun}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{res.title}</CardTitle>
            <CardDescription>
              {decryptKey.resultKeyType}: {result.key_type} {result.bits}-bit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{common.labelPrivateKeyFull}</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result.private_key_pem); toast.success(t.hycert.toolbox.common.toastCopied) }}>
                    {common.buttonCopy}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadTextFile(result.private_key_pem, 'decrypted.key')} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    .key
                  </Button>
                </div>
              </div>
              <Textarea readOnly rows={10} value={result.private_key_pem} className="font-mono text-xs" />
            </div>
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
  const [orgUnit, setOrgUnit] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [locality, setLocality] = useState('')
  const [keyType, setKeyType] = useState('rsa')
  const [keyBits, setKeyBits] = useState('2048')
  const [passphrase, setPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateCSRResponse | null>(null)

  const countryValid = !country || /^[A-Z]{2}$/.test(country)
  const canSubmit = domain.trim() && org.trim() && country.trim() && state.trim() && locality.trim() && countryValid

  const handleGenerate = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const sansList = sans.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
      const apiRes = await certUtilityApi.generateCSR({
        domain,
        sans: sansList.length ? sansList : undefined,
        subject: {
          o: org || undefined,
          ou: orgUnit || undefined,
          c: country || undefined,
          st: state || undefined,
          l: locality || undefined,
        },
        key_type: keyType,
        key_bits: parseInt(keyBits),
        passphrase: passphrase || undefined,
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
          <CardTitle className="text-base">{generateCsr.title}</CardTitle>
          <CardDescription>{generateCsr.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{generateCsr.labelDomain} *</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com / *.example.com"
            />
            <p className="text-xs text-muted-foreground">{generateCsr.hintWildcard}</p>
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

          <Separator />

          <div className="space-y-1.5">
            <Label>{generateCsr.labelOrganization} *</Label>
            <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="My Company Ltd." />
          </div>
          <div className="space-y-1.5">
            <Label>{generateCsr.labelOrgUnit}</Label>
            <Input value={orgUnit} onChange={(e) => setOrgUnit(e.target.value)} placeholder="IT" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{generateCsr.labelCountry} *</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="TW"
                maxLength={2}
              />
              {country && !countryValid && (
                <p className="text-xs text-destructive">{generateCsr.errorCountryCode}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{generateCsr.labelState} *</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Taipei City" />
            </div>
            <div className="space-y-1.5">
              <Label>{generateCsr.labelLocality} *</Label>
              <Input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Zhongzheng Dist." />
            </div>
          </div>

          <Separator />

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
          <div className="space-y-1.5">
            <Label>{generateCsr.labelPassphrase}</Label>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{generateCsr.hintPassphrase}</p>
          </div>
          <Button onClick={handleGenerate} disabled={loading || !canSubmit} className="w-full">
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
              {' · '}
              <Badge variant={result.key_encrypted ? 'secondary' : 'outline'} className="ml-1">
                {result.key_encrypted ? generateCsr.keyEncrypted : generateCsr.keyPlain}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>CSR (PEM)</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result.csr_pem); toast.success(t.hycert.toolbox.common.toastCopied) }}>
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
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(result.private_key_pem); toast.success(t.hycert.toolbox.common.toastCopied) }}>
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
