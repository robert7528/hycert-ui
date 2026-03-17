'use client'

import { useLocale } from '@/contexts/locale-context'
import { Card, CardContent } from '@/components/ui/card'

export function CertList() {
  const { t } = useLocale()

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm text-center py-8">
          {t.cert_toolbox.list_coming_soon}
        </p>
      </CardContent>
    </Card>
  )
}
