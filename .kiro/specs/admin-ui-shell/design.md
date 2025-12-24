# Design Document: Admin UI Shell

## Overview

Admin UI Shell — це архітектурний фундамент для всіх адміністративних інтерфейсів платформи. Система побудована навколо принципу "Single Source of Truth" для UI компонентів, використовуючи shadcn/ui як єдину базу та створюючи тонкі domain-specific обгортки для бізнес-логіки.

Ключова філософія: замість створення власної дизайн-системи, ми будуємо **робочу платформу** з чіткими контрактами між модулями, стандартизованими паттернами завантаження даних та уніфікованою обробкою станів.

## Architecture

### Component Hierarchy

```
Admin Shell (Layout Infrastructure)
├── Sidebar Navigation (Route-based + Permissions)
├── Header (Breadcrumbs + Actions)
└── Content Area (Module Container)
    ├── Building Blocks (Shared Components)
    │   ├── DataTable (Lists + Actions)
    │   ├── StatusBadge (Status Mapping)
    │   ├── FilterBar (Search + Filters)
    │   ├── ConfirmActionDialog (Dangerous Actions)
    │   └── State Components (Empty/Error/Loading)
    └── Admin Modules (Feature-specific)
        ├── Policies Module
        ├── Evaluation Runs Module
        └── Future Modules (Audit/Jobs/Feature Flags)
```

### Module Registration Contract

Кожен Admin Module експортує стандартний контракт:

```typescript
interface AdminModule {
  routes: RouteConfig[]
  navigationItems: NavigationItem[]
  permissions?: Permission[]
  lazyComponents: ComponentMap
}
```

### Data Fetching & Loading Patterns

**List Pages:**
- Initial load → Full skeleton table
- Refetch/filter → Subtle loading (opacity 0.6 + spinner)
- Error state → Error component with retry action

**Detail Pages:**
- Header skeleton + content skeleton during load
- Progressive loading: header first, then tabs content
- Error boundaries per section

**Actions:**
- Optimistic updates for non-critical actions (status changes)
- Pessimistic updates for critical actions (promote/cancel)
- Loading states on buttons during API calls

## Components and Interfaces

### Core Building Blocks

#### Admin_Shell
```typescript
interface AdminShellProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  headerActions?: React.ReactNode
}

// Layout structure:
// - max-w-6xl mx-auto space-y-6 (consistent grid)
// - Responsive sidebar (Sheet on mobile, fixed on desktop)
// - Header with breadcrumbs and actions
```

#### DataTable
```typescript
interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  error?: string
  pagination?: PaginationConfig
  sorting?: SortingConfig
  rowActions?: (row: T) => DropdownMenuItem[]
  emptyState?: React.ReactNode
}

// Features:
// - Built on shadcn Table + TanStack Table
// - Integrated loading/error/empty states
// - Row actions via DropdownMenu
// - Responsive horizontal scroll
```

#### StatusBadge
```typescript
interface StatusBadgeProps {
  status: RunStatus | PolicyStatus | AuditStatus
  variant?: 'default' | 'compact'
}

// Status mapping (fixed contract):
// RUNNING → default (blue)
// SUCCESS → success (green)  
// FAILED → destructive (red)
// CANCELLED → secondary (gray)
// PROMOTED → outline (purple)
// PENDING → secondary (muted)
```

#### FilterBar
```typescript
interface FilterBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: FilterConfig[]
  actions?: React.ReactNode
}

// Composition of:
// - Search Input with debounced onChange
// - Filter Select/DropdownMenu components
// - Action buttons (Create, Export, etc.)
```

#### ConfirmActionDialog
```typescript
interface ConfirmActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  requireTyping?: boolean
  onConfirm: () => Promise<void>
  variant?: 'default' | 'destructive'
}

// Features:
// - Optional typing confirmation for critical actions
// - Loading state on confirm button
// - Keyboard navigation support
```

### State Management Components

#### EmptyState
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}
```

#### ErrorState
```typescript
interface ErrorStateProps {
  error: string | Error
  retry?: () => void
  fallback?: React.ReactNode
}
```

#### LoadingState
```typescript
interface LoadingStateProps {
  type: 'skeleton' | 'spinner' | 'progress'
  message?: string
}
```

### Navigation System

#### Sidebar Navigation
```typescript
interface NavigationItem {
  id: string
  label: string
  href: string
  icon?: React.ReactNode
  badge?: string | number
  children?: NavigationItem[]
  permissions?: string[]
  disabled?: boolean
}

// Features:
// - Active state based on current route
// - Conditional visibility based on permissions
// - Badge support for notifications/counts
// - Nested navigation support
```

## Data Models

### Core Types

```typescript
// Status enums with fixed mapping
enum RunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS', 
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PROMOTED = 'PROMOTED',
  PENDING = 'PENDING'
}

enum PolicyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT'
}

// Blocking reasons for actions
interface BlockingReason {
  type: 'coverage' | 'errors' | 'status' | 'permissions'
  message: string
  details?: Record<string, any>
}

// Progress tracking
interface ProgressStats {
  processed: number
  total: number
  eligible: number
  ineligible: number
  pending: number
  errors: number
}

// Module registration
interface ModuleConfig {
  id: string
  name: string
  routes: RouteConfig[]
  navigation: NavigationItem[]
  permissions?: Permission[]
  lazyLoad?: boolean
}
```

### API Response Patterns

```typescript
// Standardized list response
interface ListResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
  filters?: Record<string, any>
}

// Standardized error response
interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, any>
  code?: string
}

// Action response
interface ActionResponse {
  success: boolean
  message?: string
  data?: any
  redirect?: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Analysis

Before defining properties, let me analyze the acceptance criteria for testability:
### Property Reflection

After analyzing the acceptance criteria, I identified several areas where properties can be consolidated:

**Component Library Consistency**: Properties 1.1, 1.2, 1.3, 1.4 can be combined into comprehensive library usage validation.

**Layout Consistency**: Properties 2.6 and 9.1 both test consistent layout classes and can be merged.

**Status Mapping**: Properties 4.1-4.8 can be combined into a single comprehensive status mapping property.

**Toast Functionality**: Properties 12.1-12.4 can be consolidated into comprehensive toast behavior validation.

### Correctness Properties

**Property 1: Component Library Consistency**
*For any* UI component in the admin system, it should either be imported from shadcn/ui, lucide-react, or be a thin wrapper around these base components with domain-specific logic only
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

**Property 2: Layout Container Consistency**
*For any* admin page, the main container should use the standard layout classes: max-w-6xl mx-auto space-y-6
**Validates: Requirements 2.6, 9.1**

**Property 3: Status Badge Mapping Consistency**
*For any* status value (RUNNING, SUCCESS, FAILED, CANCELLED, PROMOTED, PENDING, ELIGIBLE, INELIGIBLE), the StatusBadge component should map it to the correct variant according to the fixed mapping rules
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

**Property 4: DataTable Feature Completeness**
*For any* DataTable instance, it should provide sorting, pagination, row actions via DropdownMenu, and proper loading/error/empty states
**Validates: Requirements 3.1, 5.3**

**Property 5: Navigation Button Consistency**
*For any* navigation item in the Sidebar, it should use Button with variant="ghost" or NavigationMenu components
**Validates: Requirements 2.2**

**Property 6: Dangerous Action Dialog Consistency**
*For any* dangerous action (Promote, Cancel, Delete), the system should use AlertDialog for confirmation
**Validates: Requirements 8.1**

**Property 7: Tooltip on Disabled Actions**
*For any* disabled action button, when the button has blocking reasons, it should display a Tooltip with the reason details
**Validates: Requirements 7.5**

**Property 8: Responsive Sidebar Behavior**
*For any* screen size, the Sidebar should collapse to Sheet component on mobile devices (< 768px) and remain fixed on desktop
**Validates: Requirements 11.3**

**Property 9: Module Building Block Compliance**
*For any* Admin Module, all UI elements should use only shared Building Blocks and not create custom base components
**Validates: Requirements 10.2**

**Property 10: Toast Notification Consistency**
*For any* notification in the system, it should use Sonner library with appropriate auto-dismiss timing (success: 3s, error: 5s)
**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

**Property 11: Accessibility Feature Preservation**
*For any* UI component, it should maintain shadcn/ui accessibility features including keyboard navigation, ARIA labels, and focus management
**Validates: Requirements 11.1**

**Property 12: Typing Confirmation for Critical Actions**
*For any* critical action that requires typing confirmation, the ConfirmActionDialog should validate that the typed text matches the expected confirmation before enabling the confirm button
**Validates: Requirements 8.4**

## Error Handling

### Error Boundaries

**Component-Level Error Boundaries:**
- Each Building Block component has its own error boundary
- Errors in one component don't crash the entire page
- Fallback UI shows error message with retry option

**Page-Level Error Boundaries:**
- Each admin page wrapped in error boundary
- Network errors show retry button
- Permission errors show appropriate message

**Module-Level Error Boundaries:**
- Each Admin Module has top-level error boundary
- Module loading failures don't affect other modules
- Graceful degradation for missing modules

### Error State Components

**ErrorState Component:**
```typescript
interface ErrorStateProps {
  error: string | Error
  retry?: () => void
  fallback?: React.ReactNode
  variant?: 'page' | 'section' | 'inline'
}
```

**Network Error Handling:**
- 401/403: Redirect to login or show permission error
- 404: Show not found state with navigation options
- 500: Show error state with retry option
- Network timeout: Show connection error with retry

**Validation Error Handling:**
- Form validation errors shown inline
- API validation errors shown as toast notifications
- Blocking reasons shown as tooltips on disabled actions

### Loading State Management

**Progressive Loading:**
- Skeleton components for initial load
- Subtle loading indicators for updates
- Progress bars for long-running operations

**Loading State Hierarchy:**
1. Page skeleton (full page loading)
2. Section skeleton (component loading)
3. Button loading (action in progress)
4. Inline spinner (small updates)

## Testing Strategy

### Dual Testing Approach

The admin UI shell requires both **unit tests** and **property-based tests** for comprehensive coverage:

**Unit Tests Focus:**
- Specific component rendering examples
- User interaction flows (click, type, navigate)
- Edge cases (empty data, error states)
- Integration between components
- Responsive behavior at specific breakpoints

**Property-Based Tests Focus:**
- Universal properties across all components
- Status mapping consistency across all status values
- Layout consistency across all pages
- Component library compliance across all modules
- Accessibility features across all interactive elements

### Property-Based Testing Configuration

**Testing Library:** React Testing Library with @fast-check/jest for property-based testing
**Minimum Iterations:** 100 per property test
**Test Tagging Format:** **Feature: admin-ui-shell, Property {number}: {property_text}**

### Testing Patterns

**Component Testing:**
```typescript
// Unit test example
test('DataTable renders with correct columns', () => {
  render(<DataTable data={mockData} columns={mockColumns} />)
  expect(screen.getByRole('table')).toBeInTheDocument()
})

// Property test example  
test('Feature: admin-ui-shell, Property 3: Status Badge Mapping Consistency', () => {
  fc.assert(fc.property(
    fc.constantFrom('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'PROMOTED'),
    (status) => {
      const { container } = render(<StatusBadge status={status} />)
      const badge = container.querySelector('[data-testid="status-badge"]')
      expect(badge).toHaveClass(getExpectedVariantClass(status))
    }
  ))
})
```

**Integration Testing:**
- Module registration and lazy loading
- Navigation state management
- Cross-component communication
- Error boundary behavior

**Accessibility Testing:**
- Keyboard navigation flows
- Screen reader compatibility
- Focus management
- ARIA label correctness

### Performance Testing

**Bundle Size Monitoring:**
- Track shadcn/ui component usage
- Monitor lazy loading effectiveness
- Measure module loading times

**Runtime Performance:**
- DataTable rendering with large datasets
- Sidebar navigation responsiveness
- Toast notification performance
- Modal/dialog opening speed

The testing strategy ensures that the admin UI shell maintains its architectural principles while providing reliable, accessible, and performant user experience across all admin modules.