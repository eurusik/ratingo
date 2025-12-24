import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '../EmptyState'
import { FileX } from 'lucide-react'

describe('EmptyState', () => {
  test('renders with title only', () => {
    render(<EmptyState title="No data found" />)
    
    expect(screen.getByText('No data found')).toBeInTheDocument()
  })

  test('renders with icon, title, and description', () => {
    render(
      <EmptyState
        icon={<FileX data-testid="empty-icon" />}
        title="No policies found"
        description="Create your first policy to get started"
      />
    )
    
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
    expect(screen.getByText('No policies found')).toBeInTheDocument()
    expect(screen.getByText('Create your first policy to get started')).toBeInTheDocument()
  })

  test('renders with action button and handles click', () => {
    const mockAction = jest.fn()
    
    render(
      <EmptyState
        title="No data"
        action={{
          label: 'Create New',
          onClick: mockAction
        }}
      />
    )
    
    const button = screen.getByRole('button', { name: 'Create New' })
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  test('renders complete empty state with all props', () => {
    const mockAction = jest.fn()
    
    render(
      <EmptyState
        icon={<FileX data-testid="empty-icon" />}
        title="No items found"
        description="There are no items to display at the moment"
        action={{
          label: 'Add Item',
          onClick: mockAction
        }}
      />
    )
    
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument()
    expect(screen.getByText('No items found')).toBeInTheDocument()
    expect(screen.getByText('There are no items to display at the moment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument()
  })
})