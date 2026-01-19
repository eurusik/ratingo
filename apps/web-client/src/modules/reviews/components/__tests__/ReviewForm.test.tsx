import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { I18nProvider } from '@/shared/i18n/context';
import { ReviewForm } from '../review-form';
import { REVIEW_FORM_MODE, MAX_CONTENT_LENGTH } from '../../schemas';

// Wrapper with I18nProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

async function renderWithI18n(ui: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui, { wrapper: TestWrapper });
  });
  return result!;
}

describe('ReviewForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  describe('rendering', () => {
    it('should render rating label', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Як вам?')).toBeInTheDocument();
    });

    it('should render rating label for guest', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} isGuest={true} />);

      expect(screen.getByText('Оцініть')).toBeInTheDocument();
    });

    it('should render textarea for content', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(
        screen.getByPlaceholderText('Зайшло чи ні? Що сподобалось або розчарувало...'),
      ).toBeInTheDocument();
    });

    it('should render spoiler checkbox', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Містить спойлери')).toBeInTheDocument();
    });

    it('should render submit button with correct text for create mode when has content', async () => {
      await renderWithI18n(
        <ReviewForm onSubmit={mockOnSubmit} mode={REVIEW_FORM_MODE.CREATE} initialValues={{ content: 'Test' }} />,
      );

      expect(screen.getByText('Опублікувати')).toBeInTheDocument();
    });

    it('should render submit button with correct text for edit mode when has content', async () => {
      await renderWithI18n(
        <ReviewForm onSubmit={mockOnSubmit} mode={REVIEW_FORM_MODE.EDIT} initialValues={{ content: 'Test' }} />,
      );

      expect(screen.getByText('Зберегти')).toBeInTheDocument();
    });

    it('should show submitting text when isSubmitting is true and has content', async () => {
      await renderWithI18n(
        <ReviewForm onSubmit={mockOnSubmit} isSubmitting={true} initialValues={{ content: 'Test' }} />,
      );

      expect(screen.getByText('Надсилання...')).toBeInTheDocument();
    });
  });

  describe('rating display', () => {
    it('should show default rating of 70', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('70')).toBeInTheDocument();
      expect(screen.getByText('Добре')).toBeInTheDocument();
    });

    it('should use initial rating value', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} initialValues={{ rating: 90 }} />);

      expect(screen.getByText('90')).toBeInTheDocument();
    });

    it('should show "Чудово" for ratings >= 85', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} initialValues={{ rating: 90 }} />);

      expect(screen.getByText('Чудово')).toBeInTheDocument();
    });

    it('should show "Погано" for ratings < 30', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} initialValues={{ rating: 20 }} />);

      expect(screen.getByText('Погано')).toBeInTheDocument();
    });
  });

  describe('character counter', () => {
    it('should show remaining characters', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      // Format is "{current} / {max}"
      expect(screen.getByText(/0\s*\/\s*280/)).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      const textarea = screen.getByPlaceholderText(
        'Зайшло чи ні? Що сподобалось або розчарувало...',
      );
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Hello' } });
      });

      // Format is "{current} / {max}"
      expect(screen.getByText(/5\s*\/\s*280/)).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should not show submit button when content is empty', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      expect(screen.queryByText('Опублікувати')).not.toBeInTheDocument();
    });

    it('should enable submit button when content is entered', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      const textarea = screen.getByPlaceholderText(
        'Зайшло чи ні? Що сподобалось або розчарувало...',
      );
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Great movie!' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText('Опублікувати');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should disable submit button when isSubmitting', async () => {
      await renderWithI18n(
        <ReviewForm
          onSubmit={mockOnSubmit}
          isSubmitting={true}
          initialValues={{ content: 'Test' }}
        />,
      );

      const submitButton = screen.getByText('Надсилання...');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('spoiler checkbox', () => {
    it('should toggle spoiler state', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      const checkbox = screen.getByRole('checkbox');
      await act(async () => {
        fireEvent.click(checkbox);
      });

      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('should start unchecked by default', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('should start checked when initialValues.hasSpoiler is true', async () => {
      await renderWithI18n(
        <ReviewForm onSubmit={mockOnSubmit} initialValues={{ hasSpoiler: true }} />,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('initial values', () => {
    it('should populate form with initial values', async () => {
      await renderWithI18n(
        <ReviewForm
          onSubmit={mockOnSubmit}
          initialValues={{
            content: 'Initial content',
            rating: 85,
            hasSpoiler: true,
          }}
        />,
      );

      expect(screen.getByDisplayValue('Initial content')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('disabled state', () => {
    it('should disable textarea when isSubmitting', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} isSubmitting={true} />);

      const textarea = screen.getByPlaceholderText(
        'Зайшло чи ні? Що сподобалось або розчарувало...',
      );
      expect(textarea).toBeDisabled();
    });

    it('should disable checkbox when isSubmitting', async () => {
      await renderWithI18n(<ReviewForm onSubmit={mockOnSubmit} isSubmitting={true} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });
  });
});
