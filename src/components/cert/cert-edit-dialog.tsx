'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Badge, Button, Input, Label, Separator, Textarea, toast,
} from '@hysp/ui-kit'
import { Loader2, Upload, X } from 'lucide-react'
import { certCrudApi, type CertificateDTO } from '@/lib/cert-api'

interface Props {
  cert: CertificateDTO | null
  onClose: () => void
  onSuccess: () => void
}

function parseTags(tagsStr: string): string {
  try {
    const arr = JSON.parse(tagsStr)
    return Array.isArray(arr) ? arr.join(', ') : ''
  } catch {
    return ''
  }
}

export function CertEditDialog({ cert, onClose, onSuccess }: Props) {
  const { t } = useLocale()
  const cl = t.hycert.certList

  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Key upload
  const [keyContent, setKeyContent] = useState('')
  const [keyFileName, setKeyFileName] = useState('')
  const [keyPassword, setKeyPassword] = useState('')
  const [keyDragging, setKeyDragging] = useState(false)
  const [keyPasteMode, setKeyPasteMode] = useState(false)
  const keyFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cert) {
      setName(cert.name)
      setTags(parseTags(cert.tags))
      setNotes(cert.notes)
      setKeyContent('')
      setKeyFileName('')
      setKeyPassword('')
      setKeyPasteMode(false)
    }
  }, [cert])

  if (!cert) return null

  const loadKeyFile = async (file: File) => {
    const text = await file.text()
    setKeyContent(text)
    setKeyFileName(file.name)
  }

  const handleKeyDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setKeyDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await loadKeyFile(file)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const tagsJson = tags.trim()
        ? JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean))
        : '[]'

      // Update metadata
      await certCrudApi.update(cert.id, { name, tags: tagsJson, notes })

      // Upload key if provided
      if (keyContent.trim()) {
        await certCrudApi.uploadKey(cert.id, keyContent, keyPassword || undefined)
      }

      toast.success(cl.editSuccess)
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
        className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{cl.editTitle}</h2>

          <div className="space-y-2">
            <Label>{cl.editName}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{cl.editTags}</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} />
            <p className="text-xs text-muted-foreground">{cl.importTagsHint}</p>
          </div>

          <div className="space-y-2">
            <Label>{cl.editNotes}</Label>
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Upload private key — only shown if cert has no key */}
          {!cert.has_private_key && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>{cl.editUploadKey}</Label>
                {keyFileName ? (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                    <Badge variant="outline" className="text-xs">KEY</Badge>
                    <span className="flex-1 truncate">{keyFileName}</span>
                    <button onClick={() => { setKeyContent(''); setKeyFileName('') }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : keyPasteMode || keyContent ? (
                  <div className="relative">
                    <Textarea
                      placeholder="-----BEGIN PRIVATE KEY-----"
                      rows={3}
                      value={keyContent}
                      onChange={e => setKeyContent(e.target.value)}
                      autoFocus={keyPasteMode && !keyContent}
                    />
                    <button
                      onClick={() => { setKeyContent(''); setKeyPasteMode(false) }}
                      className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                      keyDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    }`}
                    onClick={() => keyFileRef.current?.click()}
                    onDrop={handleKeyDrop}
                    onDragOver={e => { e.preventDefault(); setKeyDragging(true) }}
                    onDragLeave={e => { e.preventDefault(); setKeyDragging(false) }}
                  >
                    <p className="text-sm text-muted-foreground">{cl.importKeyDropHint}</p>
                  </div>
                )}
                <input
                  ref={keyFileRef}
                  type="file"
                  className="hidden"
                  accept=".pem,.key"
                  onChange={async e => { const f = e.target.files?.[0]; if (f) await loadKeyFile(f) }}
                />
                {!keyContent && !keyFileName && !keyPasteMode && (
                  <Button variant="ghost" size="sm" onClick={() => setKeyPasteMode(true)}>
                    {cl.importKeyPaste}
                  </Button>
                )}
                {(keyContent.includes('ENCRYPTED') || keyContent.includes('Proc-Type')) && (
                  <div className="space-y-2">
                    <Label>{cl.editKeyPassword}</Label>
                    <Input
                      type="password"
                      value={keyPassword}
                      onChange={e => setKeyPassword(e.target.value)}
                      placeholder={cl.editKeyPasswordHint}
                    />
                    <p className="text-xs text-muted-foreground">{cl.importKeyPasswordHint}</p>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              {cl.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {cl.editSubmit}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
