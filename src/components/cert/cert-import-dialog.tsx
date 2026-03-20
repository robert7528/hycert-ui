'use client'

import { useState, useRef } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Input, Label, Textarea, toast,
} from '@hysp/ui-kit'
import { Loader2, Upload, X } from 'lucide-react'
import { certCrudApi } from '@/lib/cert-api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface CertFile {
  name: string
  content: string   // PEM text or base64 for binary
  inputType: string // pem | der_base64 | pfx_base64 | ...
  isBinary: boolean
}

async function readCertFile(file: File): Promise<CertFile> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const binaryExts = ['pfx', 'p12', 'der', 'jks', 'p7b']

  if (binaryExts.includes(ext)) {
    const buf = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    const typeMap: Record<string, string> = {
      pfx: 'pfx_base64', p12: 'pfx_base64', der: 'der_base64',
      jks: 'jks_base64', p7b: 'p7b_base64',
    }
    return { name: file.name, content: base64, inputType: typeMap[ext] ?? '', isBinary: true }
  }

  // Text-based: PEM or ambiguous (.cer, .crt)
  const text = await file.text()
  if (text.includes('-----BEGIN')) {
    return { name: file.name, content: text, inputType: 'pem', isBinary: false }
  }

  // Likely DER in .cer/.crt
  const buf = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  return { name: file.name, content: base64, inputType: 'der_base64', isBinary: true }
}

/** Merge multiple PEM/DER files into a single PEM string for the API */
function mergeForImport(files: CertFile[]): { certificate: string; inputType: string } {
  // Single file: send as-is
  if (files.length === 1) {
    return { certificate: files[0].content, inputType: files[0].inputType }
  }

  // Multiple files: merge all PEM text files into one PEM bundle
  // Binary files (single) can be sent directly, but multiple must all be PEM-convertible
  const allPem = files.every(f => !f.isBinary)
  if (allPem) {
    const merged = files.map(f => f.content.trim()).join('\n')
    return { certificate: merged, inputType: 'pem' }
  }

  // If there's one binary file among multiple, only send the binary (others would need conversion)
  // This case is unusual — user should use single PFX or all PEM files
  const binary = files.find(f => f.isBinary)
  if (binary) {
    return { certificate: binary.content, inputType: binary.inputType }
  }

  return { certificate: files[0].content, inputType: files[0].inputType }
}

export function CertImportDialog({ open, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [certFiles, setCertFiles] = useState<CertFile[]>([])
  const [keyContent, setKeyContent] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteContent, setPasteContent] = useState('')
  const certFileRef = useRef<HTMLInputElement>(null)
  const keyFileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setCertFiles([])
    setKeyContent('')
    setPassword('')
    setName('')
    setTags('')
    setNotes('')
    setPasteMode(false)
    setPasteContent('')
  }

  const handleCertFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newFiles: CertFile[] = []
    for (let i = 0; i < files.length; i++) {
      newFiles.push(await readCertFile(files[i]))
    }
    setCertFiles(prev => [...prev, ...newFiles])
    setPasteMode(false)

    // Reset file input so same file can be re-selected
    if (certFileRef.current) certFileRef.current.value = ''
  }

  const removeCertFile = (index: number) => {
    setCertFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setKeyContent(text)
  }

  const hasCertContent = certFiles.length > 0 || pasteContent.trim().length > 0

  const handleSubmit = async () => {
    if (!hasCertContent) return
    setLoading(true)
    try {
      const tagsJson = tags.trim()
        ? JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean))
        : '[]'

      let certificate: string
      let inputType: string | undefined

      if (certFiles.length > 0) {
        const merged = mergeForImport(certFiles)
        certificate = merged.certificate
        inputType = merged.inputType
      } else {
        certificate = pasteContent
        inputType = undefined // auto-detect
      }

      const resp = await certCrudApi.import({
        certificate,
        private_key: keyContent || undefined,
        input_type: inputType || undefined,
        password: password || undefined,
        name: name || undefined,
        tags: tagsJson,
        notes: notes || undefined,
      })

      toast.success(cl.importSuccess)
      if (resp.data?.warnings?.length) {
        resp.data.warnings.forEach(w => toast.warning(w.message))
      }
      reset()
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{cl.importTitle}</h2>
            <p className="text-sm text-muted-foreground">{cl.importDesc}</p>
          </div>

          {/* Certificate files */}
          <div className="space-y-2">
            <Label>{cl.importCert}</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => certFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                {t.hycert.toolbox.common.buttonUpload}
              </Button>
              {certFiles.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPasteMode(!pasteMode)}
                >
                  {cl.importPaste}
                </Button>
              )}
              <input
                ref={certFileRef}
                type="file"
                className="hidden"
                accept=".pem,.crt,.cer,.der,.pfx,.p12,.jks,.p7b"
                multiple
                onChange={handleCertFiles}
              />
            </div>

            {/* File list */}
            {certFiles.length > 0 && (
              <div className="space-y-1">
                {certFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <Badge variant="outline" className="text-xs">{f.inputType === 'pem' ? 'PEM' : f.inputType.replace('_base64', '').toUpperCase()}</Badge>
                    <span className="flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeCertFile(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {cl.importMultiHint}
                </p>
              </div>
            )}

            {/* Paste mode */}
            {certFiles.length === 0 && pasteMode && (
              <Textarea
                placeholder="-----BEGIN CERTIFICATE-----"
                rows={4}
                value={pasteContent}
                onChange={e => setPasteContent(e.target.value)}
              />
            )}
          </div>

          {/* Private key */}
          <div className="space-y-2">
            <Label>{cl.importKey}</Label>
            <div className="flex gap-2">
              <Textarea
                placeholder="-----BEGIN PRIVATE KEY-----"
                rows={3}
                value={keyContent}
                onChange={e => setKeyContent(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" className="self-start" onClick={() => keyFileRef.current?.click()}>
                <Upload className="h-4 w-4" />
              </Button>
              <input ref={keyFileRef} type="file" className="hidden" accept=".pem,.key" onChange={handleKeyFile} />
            </div>
          </div>

          {/* Password (for PFX/JKS) */}
          <div className="space-y-2">
            <Label>{cl.importPassword}</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t.hycert.toolbox.common.placeholderPassword}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>{cl.importName}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">{cl.importNameHint}</p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>{cl.importTags}</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} />
            <p className="text-xs text-muted-foreground">{cl.importTagsHint}</p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{cl.importNotes}</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { reset(); onClose() }}>
              {cl.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={!hasCertContent || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {cl.importSubmit}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
