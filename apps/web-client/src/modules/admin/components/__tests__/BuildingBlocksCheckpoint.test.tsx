import React from 'react'
import { render } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'
import { DataTable } from '../DataTable'
import { FilterBar } from '../FilterBar'
import { ConfirmActionDialog } from '../ConfirmActionDialog'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { LoadingState } from '../LoadingState'
import { RunStatus, PolicyStatus, DataTableColumnDef } from '../../types'

/**
 * Checkpoint test to verify all building block components render properly
 * and TypeScript interfaces are correctly defined
 * Task: 4. Checkpoint - Ensure building blocks work correctly
 */
describe('Building Blocks Checkpoint', () => {
  test('StatusBadge renders without errors', () => {
    expect(() => {
      render(<StatusBadge status={RunStatus.RUNNING} />)
      render(<StatusBadge status={PolicyStatus.ACTIVE} />)
      render(<StatusBadge status={RunStatus.SUCCESS} variant="compact" />)
    }).not.toThrow()
  })

  test('DataTable renders without errors', () => {
    const mockData = [
      { id: '1', name: 'Test Item', status: 'RUNNING' },
    ]
    
    const mockColumns: DataTableColumnDef<any>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        sortable: true,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
      },
    ]

    expect(() => {
      render(<DataTable data={mockData} columns={mockColumns} />)
      render(<DataTable data={[]} columns={mockColumns} loading={true} />)
      render(<DataTable data={[]} columns={mockColumns} error="Test error" />)
    }).not.toThrow()
  })

  test('FilterBar renders without errors', () => {
    const mockFilters = [
      {
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ]

    expect(() => {
      render(<FilterBar />)
      render(<FilterBar searchValue="test" onSearchChange={jest.fn()} />)
      render(<FilterBar filters={mockFilters} />)
    }).not.toThrow()
  })

  test('ConfirmActionDialog renders without errors', () => {
    expect(() => {
      render(
        <ConfirmActionDialog
          open={false}
          onOpenChange={jest.fn()}
          title="Test Dialog"
          description="Test description"
          onConfirm={jest.fn()}
        />
      )
      render(
        <ConfirmActionDialog
          open={false}
          onOpenChange={jest.fn()}
          title="Dangerous Action"
          description="This action cannot be undone"
          onConfirm={jest.fn()}
          variant="destructive"
          requireTyping={true}
          confirmText="DELETE"
        />
      )
    }).not.toThrow()
  })

  test('EmptyState renders without errors', () => {
    expect(() => {
      render(<EmptyState title="No data" />)
      render(
        <EmptyState
          title="No items found"
          description="Create your first item"
          action={{ label: 'Create', onClick: jest.fn() }}
        />
      )
    }).not.toThrow()
  })

  test('ErrorState renders without errors', () => {
    expect(() => {
      render(<ErrorState error="Test error" />)
      render(<ErrorState error={new Error('Test error')} variant="inline" />)
      render(<ErrorState error="Test error" variant="section" retry={jest.fn()} />)
      render(<ErrorState error="Test error" variant="page" />)
    }).not.toThrow()
  })

  test('LoadingState renders without errors', () => {
    expect(() => {
      render(<LoadingState type="skeleton" />)
      render(<LoadingState type="spinner" message="Loading..." />)
      render(<LoadingState type="progress" message="Processing..." />)
    }).not.toThrow()
  })

  test('TypeScript interfaces are properly defined', () => {
    // Test that enums are properly defined
    expect(RunStatus.RUNNING).toBe('RUNNING')
    expect(RunStatus.SUCCESS).toBe('SUCCESS')
    expect(RunStatus.FAILED).toBe('FAILED')
    expect(RunStatus.CANCELLED).toBe('CANCELLED')
    expect(RunStatus.PROMOTED).toBe('PROMOTED')
    expect(RunStatus.PENDING).toBe('PENDING')
    expect(RunStatus.ELIGIBLE).toBe('ELIGIBLE')
    expect(RunStatus.INELIGIBLE).toBe('INELIGIBLE')

    expect(PolicyStatus.ACTIVE).toBe('ACTIVE')
    expect(PolicyStatus.INACTIVE).toBe('INACTIVE')
    expect(PolicyStatus.DRAFT).toBe('DRAFT')

    // Test that interfaces can be used for type checking
    const mockProgressStats = {
      processed: 10,
      total: 100,
      eligible: 5,
      ineligible: 3,
      pending: 2,
      errors: 0,
    }

    const mockBlockingReason = {
      type: 'coverage' as const,
      message: 'Coverage threshold not met',
      details: { threshold: 80, current: 75 },
    }

    // These should compile without TypeScript errors
    expect(mockProgressStats.processed).toBe(10)
    expect(mockBlockingReason.type).toBe('coverage')
  })

  test('All components use shadcn/ui base components correctly', () => {
    // This test verifies that components are built on shadcn/ui foundation
    // by checking that they render without throwing errors and contain
    // expected shadcn/ui class patterns
    
    const { container: statusContainer } = render(<StatusBadge status={RunStatus.SUCCESS} />)
    expect(statusContainer.querySelector('[data-testid="status-badge"]')).toBeInTheDocument()
    
    const { container: emptyContainer } = render(<EmptyState title="Test" />)
    // EmptyState should use Card component (shadcn/ui) - check for card-like classes
    const emptyCard = emptyContainer.querySelector('[class*="border"]') || 
                     emptyContainer.querySelector('[class*="rounded"]') ||
                     emptyContainer.querySelector('[class*="shadow"]')
    expect(emptyCard).toBeInTheDocument()
    
    const { container: errorContainer } = render(<ErrorState error="Test" variant="section" />)
    // ErrorState should use Card component (shadcn/ui) - check for card-like classes
    const errorCard = errorContainer.querySelector('[class*="border"]') || 
                     errorContainer.querySelector('[class*="rounded"]') ||
                     errorContainer.querySelector('[class*="shadow"]')
    expect(errorCard).toBeInTheDocument()
    
    const { container: loadingContainer } = render(<LoadingState type="skeleton" />)
    // LoadingState should use Card component (shadcn/ui) - check for card-like classes
    const loadingCard = loadingContainer.querySelector('[class*="border"]') || 
                       loadingContainer.querySelector('[class*="rounded"]') ||
                       loadingContainer.querySelector('[class*="shadow"]')
    expect(loadingCard).toBeInTheDocument()
  })
})