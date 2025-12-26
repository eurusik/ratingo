"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Button } from '../../../shared/ui/button'
import { Badge } from '../../../shared/ui/badge'
import { Plus, Play } from 'lucide-react'
import { DataTable, StatusBadge, ConfirmActionDialog } from '../../../modules/admin'
import { DataTableColumnDef, POLICY_STATUS } from '../../../modules/admin/types'
import { useTranslation } from '../../../shared/i18n'
import { toast } from 'sonner'
import { usePolicies, usePreparePolicy } from '../../../core/query'
import { type PolicyDto } from '../../../core/api/admin'

// Helper to get badge variant for policy status
const getPolicyBadgeVariant = (status: string) => {
  return status === POLICY_STATUS.ACTIVE ? 'default' : 'secondary'
}

export default function PoliciesPage() {
  const router = useRouter()
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    policyId?: string
    policyName?: string
  }>({ open: false })
  
  const { dict } = useTranslation()
  const { data: policies = [], isLoading, error, refetch } = usePolicies()
  const preparePolicyMutation = usePreparePolicy()

  const columns: DataTableColumnDef<PolicyDto>[] = [
    {
      id: 'name',
      header: dict.admin.policies.columns.name,
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      )
    },
    {
      id: 'version',
      header: dict.admin.policies.columns.version,
      accessorKey: 'version',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.version}</Badge>
      )
    },
    {
      id: 'status',
      header: dict.admin.policies.columns.status,
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge variant={getPolicyBadgeVariant(row.original.status)}>
          {row.original.status === POLICY_STATUS.ACTIVE ? dict.admin.policies.status.active : dict.admin.policies.status.inactive}
        </Badge>
      )
    },
    {
      id: 'updatedAt',
      header: dict.admin.policies.columns.updated,
      accessorKey: 'updatedAt',
      cell: ({ row }) => {
        const date = new Date(row.original.updatedAt)
        return date.toLocaleDateString('uk-UA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    }
  ]

  const handlePreparePolicy = (policyId: string, policyName: string) => {
    setConfirmDialog({
      open: true,
      policyId,
      policyName
    })
  }

  const handleNewPolicy = () => {
    // TODO: Navigate to new policy creation page or open modal
    // For now, show a placeholder toast
    toast.info('Функціональність створення нової політики буде додана пізніше')
  }

  const handleConfirmPrepare = async () => {
    if (!confirmDialog.policyId) return

    try {
      const result = await preparePolicyMutation.mutateAsync({ 
        policyId: confirmDialog.policyId 
      })
      
      toast.success(dict.admin.policies.toast.prepareSuccess)
      
      // Navigate to run detail page
      router.push(`/admin/runs/${result.runId}`)
      
      setConfirmDialog({ open: false })
      
    } catch (error) {
      console.error('Failed to prepare policy:', error)
      toast.error(dict.admin.policies.toast.prepareFailed)
    }
  }

  const rowActions = (policy: PolicyDto) => [
    {
      label: dict.admin.policies.actions.view,
      onClick: () => {
        // Navigate to policy detail
        router.push(`/admin/policies/${policy.id}`)
      }
    },
    {
      label: dict.admin.policies.actions.prepare,
      onClick: () => handlePreparePolicy(policy.id, policy.name),
      icon: <Play className="h-4 w-4" />
    }
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>{dict.admin.policies.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {dict.admin.policies.description}
            </p>
          </div>
          <Button onClick={handleNewPolicy}>
            <Plus className="h-4 w-4 mr-2" />
            {dict.admin.policies.newPolicy}
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            data={policies}
            columns={columns}
            loading={isLoading}
            error={error?.message}
            rowActions={rowActions}
          />
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open })}
        title={dict.admin.policies.confirmPrepare.title}
        description={dict.admin.policies.confirmPrepare.description.replace('{policyName}', confirmDialog.policyName || '')}
        confirmText={dict.admin.policies.confirmPrepare.confirm}
        onConfirm={handleConfirmPrepare}
      />
    </div>
  )
}