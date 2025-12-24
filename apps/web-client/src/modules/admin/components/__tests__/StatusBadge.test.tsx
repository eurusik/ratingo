import React from 'react'
import { render } from '@testing-library/react'
import * as fc from 'fast-check'
import { StatusBadge, statusVariantMap } from '../StatusBadge'
import { RunStatus, PolicyStatus } from '../../types'

describe('StatusBadge', () => {
  /**
   * Feature: admin-ui-shell, Property 3: Status Badge Mapping Consistency
   * 
   * Property-based test that validates the status-to-variant mapping
   * according to requirements 4.1-4.8. This test ensures that for any
   * status value, the StatusBadge component maps it to the correct variant
   * according to the fixed mapping rules.
   */
  test('Property 3: Status Badge Mapping Consistency', () => {
    // Define the expected mapping according to requirements
    const expectedMapping: Record<RunStatus | PolicyStatus, string> = {
      // RunStatus mapping (Requirements 4.1-4.8)
      [RunStatus.RUNNING]: 'default',      // blue styling
      [RunStatus.SUCCESS]: 'success',      // green styling  
      [RunStatus.FAILED]: 'destructive',   // red styling
      [RunStatus.CANCELLED]: 'secondary',  // gray styling
      [RunStatus.PROMOTED]: 'outline',     // purple/special styling
      [RunStatus.PENDING]: 'secondary',    // muted styling
      [RunStatus.ELIGIBLE]: 'success',     // green styling
      [RunStatus.INELIGIBLE]: 'destructive', // red styling
      
      // PolicyStatus mapping
      [PolicyStatus.ACTIVE]: 'success',    // green styling
      [PolicyStatus.INACTIVE]: 'secondary', // gray styling
      [PolicyStatus.DRAFT]: 'default',     // blue styling
    }

    // Property: For any status value, the StatusBadge should map it to the correct variant
    fc.assert(
      fc.property(
        fc.constantFrom(
          ...Object.values(RunStatus),
          ...Object.values(PolicyStatus)
        ),
        (status: RunStatus | PolicyStatus) => {
          // Render the StatusBadge with the generated status
          const { container } = render(<StatusBadge status={status} />)
          const badge = container.querySelector('[data-testid="status-badge"]')
          
          // Verify the badge exists
          expect(badge).toBeInTheDocument()
          
          // Verify the status is displayed correctly
          expect(badge).toHaveTextContent(status)
          
          // Verify the data-status attribute is set correctly
          expect(badge).toHaveAttribute('data-status', status)
          
          // Verify the mapping is consistent with our statusVariantMap
          const expectedVariant = expectedMapping[status]
          const actualVariant = statusVariantMap[status]
          expect(actualVariant).toBe(expectedVariant)
          
          // Verify the CSS classes contain the expected variant styling
          const classList = badge?.className || ''
          
          // Check for variant-specific classes based on the expected mapping
          switch (expectedVariant) {
            case 'default':
              expect(classList).toMatch(/bg-primary|text-primary-foreground/)
              break
            case 'success':
              expect(classList).toMatch(/bg-green-500|text-white/)
              break
            case 'destructive':
              expect(classList).toMatch(/bg-destructive|text-destructive-foreground/)
              break
            case 'secondary':
              expect(classList).toMatch(/bg-secondary|text-secondary-foreground/)
              break
            case 'outline':
              expect(classList).toMatch(/border-purple-200|bg-purple-50|text-purple-700/)
              break
            default:
              throw new Error(`Unexpected variant: ${expectedVariant}`)
          }
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as specified in requirements
    )
  })

  // Additional unit test for specific examples
  test('renders specific status examples correctly', () => {
    const testCases = [
      { status: RunStatus.RUNNING, expectedVariant: 'default' },
      { status: RunStatus.SUCCESS, expectedVariant: 'success' },
      { status: RunStatus.FAILED, expectedVariant: 'destructive' },
      { status: PolicyStatus.ACTIVE, expectedVariant: 'success' },
    ]

    testCases.forEach(({ status, expectedVariant }) => {
      const { container } = render(<StatusBadge status={status} />)
      const badge = container.querySelector('[data-testid="status-badge"]')
      
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent(status)
      expect(statusVariantMap[status]).toBe(expectedVariant)
    })
  })

  test('supports compact variant', () => {
    const { container } = render(<StatusBadge status={RunStatus.SUCCESS} variant="compact" />)
    const badge = container.querySelector('[data-testid="status-badge"]')
    
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toMatch(/px-2\s+py-0\.5/)
  })
})