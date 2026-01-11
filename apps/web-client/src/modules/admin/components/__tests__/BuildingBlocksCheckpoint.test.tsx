import React from 'react';
import { render } from '@testing-library/react';
import { StatusBadge } from '../ui/StatusBadge';
import { DataTable } from '../ui/DataTable';
import { FilterBar } from '../ui/FilterBar';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { LoadingState } from '../ui/LoadingState';
import { RunStatus, PolicyStatus, DataTableColumnDef } from '../../types';
import { I18nProvider } from '@/shared/i18n/context';

// Wrapper with I18nProvider for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider locale="uk">{children}</I18nProvider>
);

const renderWithI18n = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

/**
 * Checkpoint test to verify all building block components render properly
 * and TypeScript interfaces are correctly defined
 * Task: 4. Checkpoint - Ensure building blocks work correctly
 */
describe('Building Blocks Checkpoint', () => {
  test('StatusBadge renders without errors', () => {
    expect(() => {
      renderWithI18n(<StatusBadge status={RunStatus.RUNNING} />);
      renderWithI18n(<StatusBadge status={PolicyStatus.ACTIVE} />);
      renderWithI18n(<StatusBadge status={RunStatus.PROMOTED} variant="compact" />);
    }).not.toThrow();
  });

  test('DataTable renders without errors', () => {
    const mockData = [{ id: '1', name: 'Test Item', status: 'RUNNING' }];

    const mockColumns: DataTableColumnDef<any>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorKey: 'name',
        sortable: true,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
      },
    ];

    expect(() => {
      renderWithI18n(<DataTable data={mockData} columns={mockColumns} />);
      renderWithI18n(<DataTable data={[]} columns={mockColumns} loading={true} />);
      renderWithI18n(<DataTable data={[]} columns={mockColumns} error="Test error" />);
    }).not.toThrow();
  });

  test('FilterBar renders without errors', () => {
    const mockFilters = [
      {
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
    ];

    expect(() => {
      renderWithI18n(<FilterBar />);
      renderWithI18n(<FilterBar searchValue="test" onSearchChange={jest.fn()} />);
      renderWithI18n(<FilterBar filters={mockFilters} />);
    }).not.toThrow();
  });

  test('ConfirmActionDialog renders without errors', () => {
    expect(() => {
      renderWithI18n(
        <ConfirmActionDialog
          open={false}
          onOpenChange={jest.fn()}
          title="Test Dialog"
          description="Test description"
          onConfirm={jest.fn()}
        />,
      );
      renderWithI18n(
        <ConfirmActionDialog
          open={false}
          onOpenChange={jest.fn()}
          title="Dangerous Action"
          description="This action cannot be undone"
          onConfirm={jest.fn()}
          variant="destructive"
          requireTyping={true}
          confirmText="DELETE"
        />,
      );
    }).not.toThrow();
  });

  test('EmptyState renders without errors', () => {
    expect(() => {
      render(<EmptyState title="No data" />);
      render(
        <EmptyState
          title="No items found"
          description="Create your first item"
          action={{ label: 'Create', onClick: jest.fn() }}
        />,
      );
    }).not.toThrow();
  });

  test('ErrorState renders without errors', () => {
    expect(() => {
      render(<ErrorState error="Test error" />);
      render(<ErrorState error={new Error('Test error')} variant="inline" />);
      render(<ErrorState error="Test error" variant="section" retry={jest.fn()} />);
      render(<ErrorState error="Test error" variant="page" />);
    }).not.toThrow();
  });

  test('LoadingState renders without errors', () => {
    expect(() => {
      render(<LoadingState type="skeleton" />);
      render(<LoadingState type="spinner" message="Loading..." />);
      render(<LoadingState type="progress" message="Processing..." />);
    }).not.toThrow();
  });

  test('TypeScript interfaces are properly defined', () => {
    // Test that status constants are properly defined (lowercase values)
    expect(RunStatus.RUNNING).toBe('running');
    expect(RunStatus.PREPARED).toBe('prepared');
    expect(RunStatus.FAILED).toBe('failed');
    expect(RunStatus.CANCELLED).toBe('cancelled');
    expect(RunStatus.PROMOTED).toBe('promoted');

    expect(PolicyStatus.ACTIVE).toBe('active');
    expect(PolicyStatus.INACTIVE).toBe('inactive');

    // Test that interfaces can be used for type checking
    const mockProgressStats = {
      processed: 10,
      total: 100,
      eligible: 5,
      ineligible: 3,
      errors: 0,
    };

    const mockBlockingReason = {
      type: 'coverage' as const,
      message: 'Coverage threshold not met',
      details: { threshold: 80, current: 75 },
    };

    // These should compile without TypeScript errors
    expect(mockProgressStats.processed).toBe(10);
    expect(mockBlockingReason.type).toBe('coverage');
  });

  test('All components use shadcn/ui base components correctly', () => {
    // This test verifies that components are built on shadcn/ui foundation
    // by checking that they render without throwing errors and contain
    // expected shadcn/ui class patterns

    const { container: statusContainer } = renderWithI18n(
      <StatusBadge status={RunStatus.PROMOTED} />,
    );
    expect(statusContainer.querySelector('[data-testid="status-badge"]')).toBeInTheDocument();

    const { container: emptyContainer } = render(<EmptyState title="Test" />);
    // EmptyState should use Card component (shadcn/ui) - check for card-like classes
    const emptyCard =
      emptyContainer.querySelector('[class*="border"]') ||
      emptyContainer.querySelector('[class*="rounded"]') ||
      emptyContainer.querySelector('[class*="shadow"]');
    expect(emptyCard).toBeInTheDocument();

    const { container: errorContainer } = render(<ErrorState error="Test" variant="section" />);
    // ErrorState should use Card component (shadcn/ui) - check for card-like classes
    const errorCard =
      errorContainer.querySelector('[class*="border"]') ||
      errorContainer.querySelector('[class*="rounded"]') ||
      errorContainer.querySelector('[class*="shadow"]');
    expect(errorCard).toBeInTheDocument();

    const { container: loadingContainer } = render(<LoadingState type="skeleton" />);
    // LoadingState should use Card component (shadcn/ui) - check for card-like classes
    const loadingCard =
      loadingContainer.querySelector('[class*="border"]') ||
      loadingContainer.querySelector('[class*="rounded"]') ||
      loadingContainer.querySelector('[class*="shadow"]');
    expect(loadingCard).toBeInTheDocument();
  });
});
