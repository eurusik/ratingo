import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorState } from '../ErrorState'

describe('ErrorState', () => {
  test('renders inline variant with string error', () => {
    render(
      <ErrorState
        error="Network connection failed"
        variant="inline"
      />
    )
    
    expect(screen.getByText('Network connection failed')).toBeInTheDocument()
  })

  test('renders inline variant with Error object', () => {
    const error = new Error('Something went wrong')
    
    render(
      <ErrorState
        error={error}
        variant="inline"
      />
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  test('renders section variant with retry button', () => {
    const mockRetry = jest.fn()
    
    render(
      <ErrorState
        error="Failed to load data"
        variant="section"
        retry={mockRetry}
      />
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
    
    const retryButton = screen.getByRole('button', { name: /try again/i })
    expect(retryButton).toBeInTheDocument()
    
    fireEvent.click(retryButton)
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  test('renders page variant', () => {
    render(
      <ErrorState
        error="Page not found"
        variant="page"
      />
    )
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  test('renders fallback component when provided', () => {
    const fallback = <div data-testid="custom-fallback">Custom error display</div>
    
    render(
      <ErrorState
        error="Some error"
        fallback={fallback}
      />
    )
    
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('Custom error display')).toBeInTheDocument()
  })

  test('defaults to section variant when no variant specified', () => {
    render(
      <ErrorState error="Default error" />
    )
    
    // Section variant shows "Something went wrong" heading
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Default error')).toBeInTheDocument()
  })

  test('inline variant shows retry button when retry function provided', () => {
    const mockRetry = jest.fn()
    
    render(
      <ErrorState
        error="Connection error"
        variant="inline"
        retry={mockRetry}
      />
    )
    
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
    
    fireEvent.click(retryButton)
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })
})