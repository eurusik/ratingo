"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Copy, Check } from 'lucide-react'
import { useTranslation } from '@/shared/i18n'
import { toast } from 'sonner'

interface JsonViewerProps {
  data: any
  title?: string
  className?: string
}

/**
 * JsonViewer component with pre in Card and copy button
 * Requirements: 3.6
 */
export function JsonViewer({ 
  data, 
  title,
  className 
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false)
  const { dict } = useTranslation()
  
  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      toast.success(dict.admin.common.copyToClipboard)
      
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error(dict.admin.common.copyFailed)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{title || dict.admin.common.jsonData}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-8"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-2" />
              {dict.admin.common.copied}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-2" />
              {dict.admin.common.copy}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 whitespace-pre-wrap">
          {jsonString}
        </pre>
      </CardContent>
    </Card>
  )
}