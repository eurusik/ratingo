/**
 * Tests for VerdictCtaButton component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictCtaButton } from '../verdict-cta-button';
import { PRIMARY_CTA } from '@/shared/types';

// Mock dictionary
const mockDict = {
  details: {
    save: 'Зберегти',
    saved: 'Збережено',
    continue: 'Продовжити',
    cta: {
      guestHint: 'Увійдіть, щоб зберегти',
      saveHint: {
        general: 'Додати до списку',
        newEpisodes: 'Є нові серії',
      },
    },
  },
  card: {
    cta: {
      details: 'Деталі',
    },
  },
  saved: {
    trigger: {
      label: {
        new_season: 'Новий сезон',
        new_episode: 'Новий епізод',
        streaming_available: 'Доступно для перегляду',
      },
    },
    actions: {
      subscribe: 'Підписатись',
    },
    unavailable: {
      already_available: 'Вже доступно',
      no_release_date: 'Немає дати виходу',
    },
  },
} as ReturnType<typeof import('@/shared/i18n').getDictionary>;

describe('VerdictCtaButton', () => {
  const defaultProps = {
    verdictType: 'general' as const,
    dict: mockDict,
  };

  describe('click handler', () => {
    it('should call onSave when primaryCta is SAVE', () => {
      const onSave = jest.fn();
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.SAVE}
          onSave={onSave}
        />,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when primaryCta is CONTINUE', () => {
      const onSave = jest.fn();
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.CONTINUE}
          continuePoint={{ season: 2, episode: 5 }}
          onSave={onSave}
        />,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when primaryCta is OPEN', () => {
      const onSave = jest.fn();
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.OPEN}
          onSave={onSave}
        />,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('display', () => {
    it('should display continue point in label for CONTINUE CTA', () => {
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.CONTINUE}
          continuePoint={{ season: 5, episode: 2 }}
        />,
      );

      expect(screen.getByText('Продовжити S5E2')).toBeInTheDocument();
    });

    it('should display "Зберегти" for SAVE CTA when not saved', () => {
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.SAVE}
          isSaved={false}
        />,
      );

      expect(screen.getByText('Зберегти')).toBeInTheDocument();
    });

    it('should display "Збережено" for SAVE CTA when saved', () => {
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.SAVE}
          isSaved={true}
        />,
      );

      expect(screen.getByText('Збережено')).toBeInTheDocument();
    });

    it('should display "Деталі" for OPEN CTA', () => {
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.OPEN}
        />,
      );

      expect(screen.getByText('Деталі')).toBeInTheDocument();
    });

    it('should show loading skeleton when isLoading and primaryCta is SAVE', () => {
      render(
        <VerdictCtaButton
          {...defaultProps}
          primaryCta={PRIMARY_CTA.SAVE}
          isLoading={true}
        />,
      );

      // Check for skeleton elements (animate-pulse classes)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
