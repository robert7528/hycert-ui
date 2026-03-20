'use client'

import { useState, useRef } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Button, Input, Label, Textarea, toast,
} from '@hysp/ui-kit'
import { Loader2, Upload } from 'lucide-react'
import { certCrudApi } from '@/lib/cert-api'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CertImportDialog({ open, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [certContent, setCertContent] = useState('')
  const [keyContent, setKeyContent] = useState('')
  const [inputType, setInputType] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [certFileName, setCertFileName] = useState('')
  const certFileRef = useRef<HTMLInputElement>(null)
  const keyFileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const reset = () => {
    setCertContent('')
    setKeyContent('')
    setInputType('')
    setPassword('')
    setName('')
    setTags('')
    setNotes('')
    setCertFileName('')
  }

  const handleCertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFileName(file.name)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const binaryExts = ['pfx', 'p12', 'der', 'jks', 'p7b']

    if (binaryExts.includes(ext)) {
      const buf = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      setCertContent(base64)
      const typeMap: Record<string, string> = { pfx: 'pfx_base64', p12: 'pfx_base64', der: 'der_base64', jks: 'jks_base64', p7b: 'p7b_base64' }
      setInputType(typeMap[ext] ?? '')
    } else {
      // Possibly PEM or ambiguous (.cer, .crt)
      const text = await file.text()
      if (text.includes('-----BEGIN')) {
        setCertContent(text)
        setInputType('pem')
      } else {
        // Likely DER in .cer/.crt
        const buf = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
        setCertContent(base64)
        setInputType('der_base64')
      }
    }
  }

  const handleKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setKeyContent(text)
  }

  const handleSubmit = async () => {
    if (!certContent) return
    setLoading(true)
    try {
      const tagsJson = tags.trim()
        ? JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean))
        : '[]'

      const resp = await certCrudApi.import({
        certificate: certContent,
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

          {/* Certificate file */}
          <div className="space-y-2">
            <Label>{cl.importCert}</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={certFileName}
                placeholder="PEM / DER / PFX / JKS / P7B"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={() => certFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                {t.hycert.toolbox.common.buttonUpload}
              </Button>
              <input
                ref={certFileRef}
                type="file"
                className="hidden"
                accept=".pem,.crt,.cer,.der,.pfx,.p12,.jks,.p7b,.key"
                onChange={handleCertFile}
              />
            </div>
            {!certFileName && (
              <Textarea
                placeholder="或貼上 PEM 內容..."
                rows={4}
                value={certContent}
                onChange={e => { setCertContent(e.target.value); setInputType('') }}
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
            <Button onClick={handleSubmit} disabled={!certContent || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {cl.importSubmit}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
