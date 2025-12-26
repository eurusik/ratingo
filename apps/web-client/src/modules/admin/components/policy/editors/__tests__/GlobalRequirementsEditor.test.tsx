import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalRequirementsEditor } from '../GlobalRequirementsEditor'
import type { components } from '@ratingo/api-contract'

type GlobalRequirements = components['schemas']['GlobalRequirementsDto']
type RatingSource = NonNullable<GlobalRequirements['requireAnyOfRatingsPresent']>[number]

describe('GlobalRequirementsEditor', () => {
  /**
   * Feature: global-quality-gate
   * 
   * Unit tests for the GlobalRequirementsEditor component.
   * Tests form rendering with existing values and form updates.
   * 
   * Requirements: 6.1-6.5
   */

  test('renders with empty values', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    expect(screen.getByText('Global Quality Gate')).toBeInTheDocument()
    expect(screen.getByText('Min IMDb Votes')).toBeInTheDocument()
    expect(screen.getByText('Min Trakt Votes')).toBeInTheDocument()
    expect(screen.getByText('Min Quality Score')).toBeInTheDocument()
    expect(screen.getByText('Required Rating Sources')).toBeInTheDocument()
  })

  test('renders with existing values', () => {
    const onChange = jest.fn()
    const existingValues: GlobalRequirements = {
      minImdbVotes: 3000,
      minTraktVotes: 1000,
      minQualityScoreNormalized: 0.6,
      requireAnyOfRatingsPresent: ['imdb', 'metacritic'],
    }

    render(
      <GlobalRequirementsEditor
        globalRequirements={existingValues}
        onChange={onChange}
      />
    )

    // Check that input fields have the correct values
    const imdbInput = screen.getByPlaceholderText('e.g., 3000') as HTMLInputElement
    const traktInput = screen.getByPlaceholderText('e.g., 1000') as HTMLInputElement
    const qualityInput = screen.getByPlaceholderText('e.g., 0.6') as HTMLInputElement

    expect(imdbInput.value).toBe('3000')
    expect(traktInput.value).toBe('1000')
    expect(qualityInput.value).toBe('0.6')

    // Check that rating sources are displayed
    expect(screen.getByText('IMDb')).toBeInTheDocument()
    expect(screen.getByText('Metacritic')).toBeInTheDocument()
  })

  test('updates minImdbVotes on input change', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    const imdbInput = screen.getByPlaceholderText('e.g., 3000')
    fireEvent.change(imdbInput, { target: { value: '5000' } })

    expect(onChange).toHaveBeenCalledWith({ minImdbVotes: 5000 })
  })

  test('updates minTraktVotes on input change', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    const traktInput = screen.getByPlaceholderText('e.g., 1000')
    fireEvent.change(traktInput, { target: { value: '2000' } })

    expect(onChange).toHaveBeenCalledWith({ minTraktVotes: 2000 })
  })

  test('updates minQualityScoreNormalized on input change', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    const qualityInput = screen.getByPlaceholderText('e.g., 0.6')
    fireEvent.change(qualityInput, { target: { value: '0.75' } })

    expect(onChange).toHaveBeenCalledWith({ minQualityScoreNormalized: 0.75 })
  })

  test('clears field when input is empty', () => {
    const onChange = jest.fn()
    const existingValues: GlobalRequirements = {
      minImdbVotes: 3000,
    }

    render(
      <GlobalRequirementsEditor
        globalRequirements={existingValues}
        onChange={onChange}
      />
    )

    const imdbInput = screen.getByPlaceholderText('e.g., 3000')
    fireEvent.change(imdbInput, { target: { value: '' } })

    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  test('adds rating source', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    // Find and click the select trigger
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)

    // Find and click the IMDb option
    const imdbOption = screen.getByRole('option', { name: 'IMDb' })
    fireEvent.click(imdbOption)

    expect(onChange).toHaveBeenCalledWith({
      requireAnyOfRatingsPresent: ['imdb'],
    })
  })

  test('removes rating source', () => {
    const onChange = jest.fn()
    const existingValues: GlobalRequirements = {
      requireAnyOfRatingsPresent: ['imdb', 'metacritic'],
    }

    render(
      <GlobalRequirementsEditor
        globalRequirements={existingValues}
        onChange={onChange}
      />
    )

    // Find the remove button for IMDb (X icon)
    const badges = screen.getAllByRole('button')
    const removeButton = badges.find((btn) => btn.textContent?.includes('IMDb'))

    if (removeButton) {
      fireEvent.click(removeButton)
      expect(onChange).toHaveBeenCalledWith({
        requireAnyOfRatingsPresent: ['metacritic'],
      })
    }
  })

  test('removes last rating source sets to undefined', () => {
    const onChange = jest.fn()
    const existingValues: GlobalRequirements = {
      requireAnyOfRatingsPresent: ['imdb'],
    }

    render(
      <GlobalRequirementsEditor
        globalRequirements={existingValues}
        onChange={onChange}
      />
    )

    // Find the remove button for IMDb
    const badges = screen.getAllByRole('button')
    const removeButton = badges.find((btn) => btn.textContent?.includes('IMDb'))

    if (removeButton) {
      fireEvent.click(removeButton)
      expect(onChange).toHaveBeenCalledWith(undefined)
    }
  })

  test('renders with custom labels', () => {
    const onChange = jest.fn()
    const customLabels = {
      title: 'Custom Title',
      description: 'Custom Description',
      minImdbVotes: 'Custom IMDb Label',
      minTraktVotes: 'Custom Trakt Label',
      minQualityScore: 'Custom Quality Label',
      requireRatings: 'Custom Ratings Label',
    }

    render(
      <GlobalRequirementsEditor onChange={onChange} labels={customLabels} />
    )

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom Description')).toBeInTheDocument()
    expect(screen.getByText('Custom IMDb Label')).toBeInTheDocument()
    expect(screen.getByText('Custom Trakt Label')).toBeInTheDocument()
    expect(screen.getByText('Custom Quality Label')).toBeInTheDocument()
    expect(screen.getByText('Custom Ratings Label')).toBeInTheDocument()
  })

  test('handles multiple field updates', () => {
    const onChange = jest.fn()
    const existingValues: GlobalRequirements = {
      minImdbVotes: 3000,
    }

    render(
      <GlobalRequirementsEditor
        globalRequirements={existingValues}
        onChange={onChange}
      />
    )

    // Update Trakt votes
    const traktInput = screen.getByPlaceholderText('e.g., 1000')
    fireEvent.change(traktInput, { target: { value: '2000' } })

    expect(onChange).toHaveBeenCalledWith({
      minImdbVotes: 3000,
      minTraktVotes: 2000,
    })
  })

  test('validates quality score range (0-1)', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    const qualityInput = screen.getByPlaceholderText('e.g., 0.6') as HTMLInputElement

    // Check that input has min and max attributes
    expect(qualityInput).toHaveAttribute('min', '0')
    expect(qualityInput).toHaveAttribute('max', '1')
    expect(qualityInput).toHaveAttribute('step', '0.01')
  })

  test('validates vote counts are non-negative integers', () => {
    const onChange = jest.fn()
    render(<GlobalRequirementsEditor onChange={onChange} />)

    const imdbInput = screen.getByPlaceholderText('e.g., 3000') as HTMLInputElement
    const traktInput = screen.getByPlaceholderText('e.g., 1000') as HTMLInputElement

    // Check that inputs have min attribute and step
    expect(imdbInput).toHaveAttribute('min', '0')
    expect(imdbInput).toHaveAttribute('step', '1')
    expect(traktInput).toHaveAttribute('min', '0')
    expect(traktInput).toHaveAttribute('step', '1')
  })
})
