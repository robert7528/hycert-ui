'use client'

import { useState, useEffect } from 'react'
import { useLocale } from '@/contexts/locale-context'
import {
  Button, Input, Label, Textarea, toast,
} from '@hysp/ui-kit'
import { Loader2 } from 'lucide-react'
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

  useEffect(() => {
    if (cert) {
      setName(cert.name)
      setTags(parseTags(cert.tags))
      setNotes(cert.notes)
    }
  }, [cert])

  if (!cert) return null

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const tagsJson = tags.trim()
        ? JSON.stringify(tags.split(',').map(s => s.trim()).filter(Boolean))
        : '[]'

      await certCrudApi.update(cert.id, {
        name,
        tags: tagsJson,
        notes,
      })

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
        className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4"
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
