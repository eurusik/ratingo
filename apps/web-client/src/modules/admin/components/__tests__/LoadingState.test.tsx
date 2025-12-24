import React from 'react'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  test('renders skeleton variant', () => {
    render(<LoadingState type="skeleton" />)
    
    // Check for skeleton elements (they should have skeleton class)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('renders skeleton variant with message', () => {
    render(<LoadingState type="skeleton" message="Loading policies..." />)
    
    expect(screen.getByText('Loading policies...')).toBeInTheDocument()
  })

  test('renders spinner variant', () => {
    render(<LoadingState type="spinner" />)
    
    // Check for spinner icon (Loader2 with animate-spin)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('renders spinner variant with message', () => {
    render(<LoadingState type="spinner" message="Processing request..." />)
    
    expect(screen.getByText('Processing request...')).toBeInTheDocument()
    
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  test('renders progress variant', () => {
    render(<LoadingState type="progress" />)
    
    // Check for progress bar element
    const progressBar = document.querySelector('[role="progressbar"]')
    expect(progressBar).toBeInTheDocument()
  })

  test('renders progress variant with message', () => {
    render(<LoadingState type="progress" message="Evaluating policies..." />)
    
    expect(screen.getByText('Evaluating policies...')).toBeInTheDocument()
    
    const progressBar = document.querySelector('[role="progressbar"]')
    expect(progressBar).toBeInTheDocument()
  })

  test('all variants render without errors', () => {
    const variants: Array<'skeleton' | 'spinner' | 'progress'> = ['skeleton', 'spinner', 'progress']
    
    variants.forEach(variant => {
      const { unmount } = render(<LoadingState type={variant} message={`Loading ${variant}...`} />)
      expect(screen.getByText(`Loading ${variant}...`)).toBeInTheDocument()
      unmount()
    })
  })
})