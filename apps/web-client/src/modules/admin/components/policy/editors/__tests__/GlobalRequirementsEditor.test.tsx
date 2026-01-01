import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalRequirementsEditor } from '../GlobalRequirementsEditor';
import type { GlobalRequirements } from '@/core/api/admin';

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
    const onChange = jest.fn();
    render(<GlobalRequirementsEditor onChange={onChange} />);

    expect(screen.getByText('Global Quality Gate')).toBeInTheDocument();
    expect(screen.getByText('Min Votes (Any Source)')).toBeInTheDocument();
    expect(screen.getByText('Min Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Required Rating Sources')).toBeInTheDocument();
  });

  test('renders with existing values', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      minVotesAnyOf: { sources: ['imdb', 'trakt'], min: 3000 },
      minQualityScoreNormalized: 0.6,
      requireAnyOfRatingsPresent: ['imdb', 'metacritic'],
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    // Check that quality score input has the correct value
    const qualityInput = screen.getByPlaceholderText('e.g., 0.6') as HTMLInputElement;
    expect(qualityInput.value).toBe('0.6');

    // Check that min votes input has the correct value
    const votesInput = screen.getByPlaceholderText('e.g., 3000') as HTMLInputElement;
    expect(votesInput.value).toBe('3000');

    // Check that rating sources are displayed (IMDb appears multiple times - in badges and checkboxes)
    expect(screen.getAllByText('IMDb').length).toBeGreaterThan(0);
    expect(screen.getByText('Metacritic')).toBeInTheDocument();
  });

  test('updates minQualityScoreNormalized on input change', () => {
    const onChange = jest.fn();
    render(<GlobalRequirementsEditor onChange={onChange} />);

    const qualityInput = screen.getByPlaceholderText('e.g., 0.6');
    fireEvent.change(qualityInput, { target: { value: '0.75' } });

    expect(onChange).toHaveBeenCalledWith({ minQualityScoreNormalized: 0.75 });
  });

  test('clears field when input is empty', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      minQualityScoreNormalized: 0.6,
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    const qualityInput = screen.getByPlaceholderText('e.g., 0.6');
    fireEvent.change(qualityInput, { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test('adds rating source', () => {
    const onChange = jest.fn();
    render(<GlobalRequirementsEditor onChange={onChange} />);

    // Find and click the select trigger
    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    // Find and click the IMDb option
    const imdbOption = screen.getByRole('option', { name: 'IMDb' });
    fireEvent.click(imdbOption);

    expect(onChange).toHaveBeenCalledWith({
      requireAnyOfRatingsPresent: ['imdb'],
    });
  });

  test('removes rating source', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      requireAnyOfRatingsPresent: ['imdb', 'metacritic'],
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    // Find the remove button for IMDb (X icon in badge)
    const badges = screen.getAllByRole('button');
    const removeButton = badges.find((btn) => btn.textContent?.includes('IMDb'));

    if (removeButton) {
      fireEvent.click(removeButton);
      expect(onChange).toHaveBeenCalledWith({
        requireAnyOfRatingsPresent: ['metacritic'],
      });
    }
  });

  test('removes last rating source sets to undefined', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      requireAnyOfRatingsPresent: ['imdb'],
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    // Find the remove button for IMDb
    const badges = screen.getAllByRole('button');
    const removeButton = badges.find((btn) => btn.textContent?.includes('IMDb'));

    if (removeButton) {
      fireEvent.click(removeButton);
      expect(onChange).toHaveBeenCalledWith(undefined);
    }
  });

  test('renders with custom labels', () => {
    const onChange = jest.fn();
    const customLabels = {
      title: 'Custom Title',
      description: 'Custom Description',
      minQualityScore: 'Custom Quality Label',
      requireRatings: 'Custom Ratings Label',
      minVotesAnyOf: 'Custom Votes Label',
    };

    render(<GlobalRequirementsEditor onChange={onChange} labels={customLabels} />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
    expect(screen.getByText('Custom Quality Label')).toBeInTheDocument();
    expect(screen.getByText('Custom Ratings Label')).toBeInTheDocument();
    expect(screen.getByText('Custom Votes Label')).toBeInTheDocument();
  });

  test('handles minVotesAnyOf updates', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      minVotesAnyOf: { sources: ['imdb'], min: 3000 },
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    // Update min votes value
    const votesInput = screen.getByPlaceholderText('e.g., 3000');
    fireEvent.change(votesInput, { target: { value: '5000' } });

    expect(onChange).toHaveBeenCalledWith({
      minVotesAnyOf: { sources: ['imdb'], min: 5000 },
    });
  });

  test('validates quality score range (0-1)', () => {
    const onChange = jest.fn();
    render(<GlobalRequirementsEditor onChange={onChange} />);

    const qualityInput = screen.getByPlaceholderText('e.g., 0.6') as HTMLInputElement;

    // Check that input has min and max attributes
    expect(qualityInput).toHaveAttribute('min', '0');
    expect(qualityInput).toHaveAttribute('max', '1');
    expect(qualityInput).toHaveAttribute('step', '0.01');
  });

  test('validates vote counts input attributes', () => {
    const onChange = jest.fn();
    const existingValues: GlobalRequirements = {
      minVotesAnyOf: { sources: ['imdb'], min: 3000 },
    };

    render(<GlobalRequirementsEditor globalRequirements={existingValues} onChange={onChange} />);

    const votesInput = screen.getByPlaceholderText('e.g., 3000') as HTMLInputElement;

    // Check that input has min attribute and step
    expect(votesInput).toHaveAttribute('min', '0');
    expect(votesInput).toHaveAttribute('step', '100');
  });

  test('toggles vote source checkbox', () => {
    const onChange = jest.fn();
    render(<GlobalRequirementsEditor onChange={onChange} />);

    // Find IMDb checkbox in the votes section
    const checkboxes = screen.getAllByRole('checkbox');
    const imdbCheckbox = checkboxes.find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('IMDb');
    });

    if (imdbCheckbox) {
      fireEvent.click(imdbCheckbox);
      expect(onChange).toHaveBeenCalledWith({
        minVotesAnyOf: { sources: ['imdb'], min: 0 },
      });
    }
  });
});
