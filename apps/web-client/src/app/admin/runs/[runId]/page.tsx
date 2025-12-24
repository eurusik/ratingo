"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { 
  StatusBadge, 
  ProgressWithStats, 
  ConfirmActionDialog,
  JsonViewer,
  DataTable 
} from '@/modules/admin'
import { RunStatus, RunStatusType, BlockingReason, ProgressStats, DataTableColumnDef } from '@/modules/admin/types'
import { toast } from 'sonner'

interface RunDetail {
  id: string
  policyName: string
  status: RunStatusType
  progress: ProgressStats
  startedAt: string
  finishedAt?: string
  readyToPromote: boolean
  blockingReasons: BlockingReason[]
}

interface DiffItem {
  id: string
  type: 'added' | 'removed' | 'modified'
  name: string
  details: any
}

interface ErrorSample {
  id: string
  message: string
  count: number
  details: any
  stackTrace?: string
}

// Mock data
const mockRun: RunDetail = {
  id: 'run-002',
  policyName: 'Rating Validation Policy',
  status: RunStatus.RUNNING,
  progress: {
    processed: 750,
    total: 1200,
    eligible: 600,
    ineligible: 100,
    pending: 450,
    errors: 50
  },
  startedAt: '2024-12-20T14:00:00Z',
  readyToPromote: false,
  blockingReasons: [
    {
      type: 'coverage',
      message: 'Coverage threshold not met (62.5% < 80%)',
      details: { current: 62.5, required: 80 }
    },
    {
      type: 'errors',
      message: '50 errors found during evaluation',
      details: { errorCount: 50, maxAllowed: 10 }
    }
  ]
}

const mockDiffItems: DiffItem[] = [
  {
    id: '1',
    type: 'added',
    name: 'Movie: The Matrix Resurrections',
    details: { rating: 6.8, genre: 'Sci-Fi' }
  },
  {
    id: '2',
    type: 'modified',
    name: 'Movie: Dune',
    details: { oldRating: 8.0, newRating: 8.2 }
  },
  {
    id: '3',
    type: 'removed',
    name: 'Movie: Old Title',
    details: { reason: 'No longer available' }
  }
]

const mockErrors: ErrorSample[] = [
  {
    id: '1',
    message: 'Invalid rating format',
    count: 25,
    details: { field: 'rating', expectedFormat: 'number', receivedFormat: 'string' },
    stackTrace: 'ValidationError: Invalid rating format\n  at validateRating (validator.js:42)\n  at processMovie (processor.js:18)'
  },
  {
    id: '2',
    message: 'Missing required field: genre',
    count: 15,
    details: { field: 'genre', movieId: 'movie-123' }
  },
  {
    id: '3',
    message: 'API timeout',
    count: 10,
    details: { timeout: 5000, endpoint: '/api/movies/validate' }
  }
]

export default function RunDetailPage({ params }: { params: { runId: string } }) {
  const [run] = useState<RunDetail>(mockRun)
  const [diffItems] = useState<DiffItem[]>(mockDiffItems)
  const [errors] = useState<ErrorSample[]>(mockErrors)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type?: 'promote' | 'cancel'
  }>({ open: false })

  const handlePromote = async () => {
    try {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success('Run promoted successfully')
    } catch (error) {
      toast.error('Failed to promote run')
    }
  }

  const handleCancel = async () => {
    try {
      // TODO: Replace with real API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Run cancelled successfully')
    } catch (error) {
      toast.error('Failed to cancel run')
    }
  }

  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId)
    } else {
      newExpanded.add(errorId)
    }
    setExpandedErrors(newExpanded)
  }

  const diffColumns: DataTableColumnDef<DiffItem>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const { type } = row.original
        const variants = {
          added: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
          modified: { variant: 'outline' as const, icon: AlertTriangle, color: 'text-yellow-600' },
          removed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' }
        }
        const config = variants[type]
        const Icon = config.icon
        
        return (
          <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
            <Icon className={`h-3 w-3 ${config.color}`} />
            {type}
          </Badge>
        )
      }
    },
    {
      id: 'name',
      header: 'Item',
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      )
    },
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <JsonViewer data={row.original.details} title="Item Details" />
      )
    }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Run Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                Run {run.id}
                <StatusBadge status={run.status} />
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Policy: {run.policyName} • Started: {new Date(run.startedAt).toLocaleString('uk-UA')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {run.status === RunStatus.RUNNING && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDialog({ open: true, type: 'cancel' })}
                >
                  Cancel
                </Button>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        disabled={!run.readyToPromote}
                        onClick={() => setConfirmDialog({ open: true, type: 'promote' })}
                      >
                        Promote
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!run.readyToPromote && (
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-medium">Cannot promote due to:</p>
                        {run.blockingReasons.map((reason, index) => (
                          <p key={index} className="text-sm">• {reason.message}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Card */}
      <ProgressWithStats stats={run.progress} />

      {/* Tabs */}
      <Tabs defaultValue="diff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {run.progress.errors > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 text-xs">
                {run.progress.errors}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Changes Summary</CardTitle>
              <div className="flex space-x-4 text-sm text-muted-foreground">
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  {diffItems.filter(item => item.type === 'added').length} added
                </span>
                <span className="flex items-center">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mr-1" />
                  {diffItems.filter(item => item.type === 'modified').length} modified
                </span>
                <span className="flex items-center">
                  <XCircle className="h-4 w-4 text-red-600 mr-1" />
                  {diffItems.filter(item => item.type === 'removed').length} removed
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                data={diffItems}
                columns={diffColumns}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Samples</CardTitle>
              <p className="text-sm text-muted-foreground">
                {run.progress.errors} errors found during evaluation
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {errors.map((error) => (
                  <CollapsiblePrimitive.Root key={error.id}>
                    <CollapsiblePrimitive.Trigger
                      className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50"
                      onClick={() => toggleErrorExpansion(error.id)}
                    >
                      <div className="flex items-center space-x-3">
                        {expandedErrors.has(error.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="text-left">
                          <div className="font-medium">{error.message}</div>
                          <div className="text-sm text-muted-foreground">
                            {error.count} occurrences
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive">{error.count}</Badge>
                    </CollapsiblePrimitive.Trigger>
                    <CollapsiblePrimitive.Content className="px-4 pb-4">
                      <div className="space-y-4 mt-4">
                        <JsonViewer 
                          data={error.details} 
                          title="Error Details"
                        />
                        {error.stackTrace && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Stack Trace</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <pre className="text-xs bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap">
                                {error.stackTrace}
                              </pre>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </CollapsiblePrimitive.Content>
                  </CollapsiblePrimitive.Root>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialogs */}
      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'promote'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title="Promote Run"
        description="Are you sure you want to promote this run? This will apply all changes to the production environment."
        confirmText="PROMOTE"
        requireTyping={true}
        onConfirm={handlePromote}
        variant="default"
      />

      <ConfirmActionDialog
        open={confirmDialog.open && confirmDialog.type === 'cancel'}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title="Cancel Run"
        description="Are you sure you want to cancel this running evaluation? This action cannot be undone."
        confirmText="Cancel Run"
        onConfirm={handleCancel}
        variant="destructive"
      />
    </div>
  )
}