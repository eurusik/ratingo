import React from 'react';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import { StatusBadge, statusVariantMap } from '../ui/StatusBadge';
import { RUN_STATUS, POLICY_STATUS } from '../../types';
import { I18nProvider } from '@/shared/i18n/context';

// Wrapper with I18nProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

const renderWithI18n = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

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
    // Define the expected mapping according to requirements (lowercase values)
    const expectedMapping: Record<string, string> = {
      // RunStatus mapping
      [RUN_STATUS.RUNNING]: 'default', // blue styling
      [RUN_STATUS.PREPARED]: 'success', // green styling (prepared = success)
      [RUN_STATUS.FAILED]: 'destructive', // red styling
      [RUN_STATUS.CANCELLED]: 'secondary', // gray styling
      [RUN_STATUS.PROMOTED]: 'outline', // purple/special styling

      // PolicyStatus mapping
      [POLICY_STATUS.ACTIVE]: 'success', // green styling
      [POLICY_STATUS.INACTIVE]: 'secondary', // gray styling
    };

    // Property: For any status value, the StatusBadge should map it to the correct variant
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(RUN_STATUS), ...Object.values(POLICY_STATUS)),
        (status: string) => {
          // Render the StatusBadge with the generated status
          const { container } = renderWithI18n(<StatusBadge status={status} />);
          const badge = container.querySelector('[data-testid="status-badge"]');

          // Verify the badge exists
          expect(badge).toBeInTheDocument();

          // Verify the data-status attribute is set correctly
          expect(badge).toHaveAttribute('data-status', status);

          // Verify the mapping is consistent with our statusVariantMap
          const expectedVariant = expectedMapping[status];
          const actualVariant = statusVariantMap[status];
          expect(actualVariant).toBe(expectedVariant);
        },
      ),
      { numRuns: 100 }, // Minimum 100 iterations as specified in requirements
    );
  });

  // Additional unit test for specific examples
  test('renders specific status examples correctly', () => {
    const testCases = [
      { status: RUN_STATUS.RUNNING, expectedVariant: 'default' },
      { status: RUN_STATUS.PREPARED, expectedVariant: 'success' },
      { status: RUN_STATUS.FAILED, expectedVariant: 'destructive' },
      { status: POLICY_STATUS.ACTIVE, expectedVariant: 'success' },
    ];

    testCases.forEach(({ status, expectedVariant }) => {
      const { container } = renderWithI18n(<StatusBadge status={status} />);
      const badge = container.querySelector('[data-testid="status-badge"]');

      expect(badge).toBeInTheDocument();
      expect(statusVariantMap[status]).toBe(expectedVariant);
    });
  });

  test('supports compact variant', () => {
    const { container } = renderWithI18n(
      <StatusBadge status={RUN_STATUS.PREPARED} variant="compact" />,
    );
    const badge = container.querySelector('[data-testid="status-badge"]');

    expect(badge).toBeInTheDocument();
    expect(badge?.className).toMatch(/px-2\s+py-0\.5/);
  });
});
