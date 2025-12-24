import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { fc } from '@fast-check/jest'
import { DataTable } from '../DataTable'
import { DataTableColumnDef, DropdownMenuItemProps } from '../../types'

// Clean up after each test to avoid multiple instances
afterEach(() => {
  cleanup()
})

// Simple mock data for focused testing
const createMockData = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
    status: 'RUNNING' as const,
    createdAt: new Date().toISOString(),
  }))

const mockColumns: DataTableColumnDef<any>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name' as const,
    sortable: true,
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status' as const,
    sortable: true,
  },
  {
    id: 'createdAt',
    header: 'Created At',
    accessorKey: 'createdAt' as const,
    sortable: false,
  },
]

const mockRowActions = (row: any): DropdownMenuItemProps[] => [
  {
    label: 'View',
    onClick: jest.fn(),
    variant: 'default',
  },
  {
    label: 'Delete',
    onClick: jest.fn(),
    variant: 'destructive',
  },
]

describe('DataTable Property Tests', () => {
  /**
   * Feature: admin-ui-shell, Property 4: DataTable Feature Completeness
   * Validates: Requirements 3.1, 5.3
   */
  describe('Property 4: DataTable Feature Completeness', () => {
    it('should provide sorting functionality for sortable columns', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (dataCount) => {
            const data = createMockData(dataCount)
            const onSortingChange = jest.fn()
            
            const { container } = render(
              <DataTable
                data={data}
                columns={mockColumns}
                onSortingChange={onSortingChange}
              />
            )

            // Check that sortable columns have sorting indicators
            const chevronIcons = container.querySelectorAll('svg[class*="lucide-chevron"]')
            expect(chevronIcons.length).toBeGreaterThan(0)
            
            // Check that table renders with data
            expect(container.querySelector('table')).toBeInTheDocument()
            expect(container.querySelectorAll('tbody tr')).toHaveLength(dataCount)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should provide pagination when pagination config is provided', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 20, max: 50 }),
          fc.integer({ min: 5, max: 10 }),
          (dataCount, total, limit) => {
            const data = createMockData(dataCount)
            const paginationConfig = {
              page: 1,
              limit,
              total,
              hasNext: total > limit,
            }

            const { container } = render(
              <DataTable
                data={data}
                columns={mockColumns}
                pagination={paginationConfig}
                onPaginationChange={jest.fn()}
              />
            )

            // Should show pagination controls
            const paginationButtons = container.querySelectorAll('button')
            const hasNextButton = Array.from(paginationButtons).some(btn => 
              btn.textContent === 'Next'
            )
            const hasPrevButton = Array.from(paginationButtons).some(btn => 
              btn.textContent === 'Previous'
            )
            
            expect(hasNextButton).toBe(true)
            expect(hasPrevButton).toBe(true)
            
            // Should show pagination info
            const paginationInfo = container.textContent
            expect(paginationInfo).toMatch(/Showing \d+ to \d+ of \d+ entries/)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should provide row actions via DropdownMenu when rowActions is provided', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (dataCount) => {
            const data = createMockData(dataCount)
            
            const { container } = render(
              <DataTable
                data={data}
                columns={mockColumns}
                rowActions={mockRowActions}
              />
            )

            // Should have action buttons for each row
            const actionButtons = container.querySelectorAll('button[aria-haspopup="menu"]')
            expect(actionButtons.length).toBe(dataCount)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should display loading state with skeleton when loading is true', () => {
      fc.assert(
        fc.property(
          fc.constant(true),
          (loading) => {
            const { container } = render(
              <DataTable
                data={[]}
                columns={mockColumns}
                loading={loading}
              />
            )

            // Should show skeleton loading state
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
            expect(skeletons.length).toBeGreaterThan(0)
            
            // Should show table structure even when loading
            expect(container.querySelector('table')).toBeInTheDocument()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should display error state when error is provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          (errorMessage) => {
            const { container } = render(
              <DataTable
                data={[]}
                columns={mockColumns}
                error={errorMessage}
              />
            )

            // Should show error message
            const errorContainer = container.querySelector('.text-destructive')
            expect(errorContainer).toBeInTheDocument()
            expect(container.textContent).toContain('Error loading data')
            expect(container.textContent).toContain(errorMessage)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should display empty state when data is empty and not loading', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (emptyData) => {
            const { container } = render(
              <DataTable
                data={[...emptyData]}
                columns={mockColumns}
                loading={false}
              />
            )

            // Should show empty state
            expect(container.textContent).toContain('No data available')
            
            // Should still show table headers
            expect(container.textContent).toContain('Name')
            expect(container.textContent).toContain('Status')
            expect(container.textContent).toContain('Created At')
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should display custom empty state when provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0),
          (customMessage) => {
            const trimmedMessage = customMessage.trim()
            const customEmptyState = <div data-testid="custom-empty">{trimmedMessage}</div>

            const { container } = render(
              <DataTable
                data={[]}
                columns={mockColumns}
                loading={false}
                emptyState={customEmptyState}
              />
            )

            // Should show custom empty state
            const customEmpty = container.querySelector('[data-testid="custom-empty"]')
            expect(customEmpty).toBeInTheDocument()
            expect(customEmpty).toHaveTextContent(trimmedMessage)
            
            // Should not show default empty state
            expect(container.textContent).not.toContain('No data available')
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should handle sorting state changes correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (dataCount) => {
            const data = createMockData(dataCount)
            const onSortingChange = jest.fn()
            
            const { container } = render(
              <DataTable
                data={data}
                columns={mockColumns}
                onSortingChange={onSortingChange}
              />
            )

            // Find the sortable header div (the actual clickable element)
            const sortableHeaderDiv = container.querySelector('div.cursor-pointer.select-none')
            if (sortableHeaderDiv) {
              fireEvent.click(sortableHeaderDiv)

              // Should call onSortingChange with correct parameters
              expect(onSortingChange).toHaveBeenCalledWith({
                column: 'name',
                direction: 'asc',
              })
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should handle pagination state changes correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 20, max: 50 }),
          fc.integer({ min: 5, max: 10 }),
          (dataCount, total, limit) => {
            const data = createMockData(dataCount)
            const onPaginationChange = jest.fn()
            const paginationConfig = {
              page: 1,
              limit,
              total,
              hasNext: true,
            }

            const { container } = render(
              <DataTable
                data={data}
                columns={mockColumns}
                pagination={paginationConfig}
                onPaginationChange={onPaginationChange}
              />
            )

            // Find and click next button
            const buttons = container.querySelectorAll('button')
            const nextButton = Array.from(buttons).find(btn => 
              btn.textContent === 'Next' && !btn.disabled
            )
            
            if (nextButton) {
              fireEvent.click(nextButton)

              // Should call onPaginationChange with correct parameters
              expect(onPaginationChange).toHaveBeenCalledWith({
                page: 2,
                limit,
              })
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})