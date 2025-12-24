# Requirements Document

## Introduction

Admin UI Shell — уніфікована система UI-компонентів та layout для адміністративного інтерфейсу платформи. Система базується на shadcn/ui як єдиному джерелі базових компонентів, забезпечуючи консистентний вигляд, доступність та розширюваність для всіх адмін-модулів (Catalog Policies, Evaluation Runs, майбутні Audit/Jobs/Feature Flags).

Ключові принципи:
- Тільки shadcn/ui компоненти як базові цеглинки — ніяких власних аналогів Button/Table
- Thin wrappers навколо shadcn тільки для domain-specific логіки (StatusBadge, DataTable)
- Модульна архітектура — кожен адмін-модуль використовує shared building blocks
- Консистентний стиль через єдині spacing/layout правила

## Glossary

- **Admin_Shell**: Головний layout з Sidebar, Header та Content area для всіх адмін-сторінок
- **Shadcn_UI**: Бібліотека UI-компонентів на базі Radix UI primitives з Tailwind стилізацією
- **DataTable**: Shared wrapper над shadcn Table з сортуванням, пагінацією та row actions
- **StatusBadge**: Thin wrapper над Badge з єдиним мапінгом RunStatus → variant
- **FilterBar**: Композиція Input, Select, Button, DropdownMenu для фільтрації списків
- **ConfirmActionDialog**: Wrapper над AlertDialog для confirm дій (Promote/Cancel)
- **Admin_Module**: Ізольований набір page-компонентів для конкретної функціональності (policies, runs, audit)
- **Building_Block**: Shared компонент, який реюзається між модулями
- **Run_Status**: Статус evaluation run: RUNNING, SUCCESS, FAILED, CANCELLED, PROMOTED
- **Blocking_Reason**: Причина, чому Promote недоступний (coverage threshold, errors, status)

## Requirements

### Requirement 1: UI Stack та базові компоненти

**User Story:** As a frontend developer, I want a standardized UI stack, so that I can build consistent admin interfaces without reinventing components.

#### Acceptance Criteria

1. THE System SHALL use shadcn/ui for all base components: Button, Card, Table, Dialog, Tabs, Badge, Progress, DropdownMenu, Tooltip, Toast (Sonner), Separator, Sheet, Skeleton, Input, Select, Textarea
2. THE System SHALL use Tailwind CSS for all styling (де-факто з shadcn)
3. THE System SHALL use lucide-react for all icons
4. THE System SHALL NOT create custom analogs of shadcn base components — only thin wrappers with domain-specific logic
5. WHEN a new UI element is needed, THE Developer SHALL first check if shadcn provides it before creating custom component

### Requirement 2: Admin Shell Layout

**User Story:** As a user, I want a consistent admin layout, so that I can navigate between different admin sections easily.

#### Acceptance Criteria

1. THE Admin_Shell SHALL provide Sidebar navigation using Sheet (mobile) + fixed panel (desktop)
2. THE Sidebar SHALL contain navigation items using Button variant="ghost" or NavigationMenu
3. THE Admin_Shell SHALL provide Header with Breadcrumb, Separator, and DropdownMenu for profile/actions
4. THE Admin_Shell SHALL provide Content area with Card-based sections and consistent spacing
5. THE Admin_Shell SHALL support responsive layout: collapsed sidebar on mobile, expanded on desktop
6. THE Admin_Shell SHALL use consistent max-width container: max-w-6xl mx-auto space-y-6

### Requirement 3: Shared Building Blocks

**User Story:** As a frontend developer, I want reusable building blocks, so that every new module uses the same UI patterns.

#### Acceptance Criteria

1. THE System SHALL provide DataTable component as wrapper over shadcn Table with sorting, pagination, and row actions via DropdownMenu
2. THE System SHALL provide FilterBar component composing Input, Select, Button, DropdownMenu for list filtering
3. THE System SHALL provide StatusBadge component as wrapper over Badge with unified RunStatus → variant mapping
4. THE System SHALL provide ProgressWithStats component combining Progress with Badge/Card for counters display
5. THE System SHALL provide ConfirmActionDialog component as wrapper over AlertDialog for dangerous actions
6. THE System SHALL provide JsonViewer component with pre in Card and copy button
7. THE System SHALL provide EmptyState component with Card and action Button

### Requirement 4: Status Badge Mapping

**User Story:** As a user, I want consistent status indicators, so that I can quickly understand the state of any item.

#### Acceptance Criteria

1. THE StatusBadge SHALL map RUNNING status to "default" variant with blue styling
2. THE StatusBadge SHALL map SUCCESS status to "success" variant with green styling
3. THE StatusBadge SHALL map FAILED status to "destructive" variant with red styling
4. THE StatusBadge SHALL map CANCELLED status to "secondary" variant with gray styling
5. THE StatusBadge SHALL map PROMOTED status to "outline" variant with purple/special styling
6. THE StatusBadge SHALL map PENDING status to "secondary" variant with muted styling
7. THE StatusBadge SHALL map ELIGIBLE status to "success" variant
8. THE StatusBadge SHALL map INELIGIBLE status to "destructive" variant

### Requirement 5: Policies List Page (/admin/policies)

**User Story:** As an admin, I want to view and manage catalog policies, so that I can control content filtering rules.

#### Acceptance Criteria

1. THE Policies page SHALL display Card with header containing title and action buttons
2. THE Policies page SHALL display DataTable with columns: Name, Version, Active (Badge), UpdatedAt
3. THE DataTable SHALL provide row action menu via DropdownMenu with options: View, Prepare
4. WHEN user clicks Prepare action, THE System SHALL show AlertDialog for confirmation
5. WHEN Prepare is confirmed, THE System SHALL show toast (Sonner) notification and redirect to run page
6. THE Policies page SHALL support filtering by active status

### Requirement 6: Policy Detail Page (/admin/policies/:id)

**User Story:** As an admin, I want to view policy details and its evaluation runs, so that I can track policy history.

#### Acceptance Criteria

1. THE Policy detail page SHALL use Tabs component with tabs: Runs, Policy
2. THE Runs tab SHALL display DataTable with columns: Run ID, Status (StatusBadge), Progress (mini Progress), Started, Finished
3. THE Policy tab SHALL display policy details in Card format
4. THE DataTable rows SHALL be clickable to navigate to run detail page
5. THE page SHALL show policy version and active status in header

### Requirement 7: Run Detail Page (/admin/runs/:runId)

**User Story:** As an admin, I want to view run progress and take actions, so that I can manage policy activation.

#### Acceptance Criteria

1. THE Run detail page SHALL display top Card with progress information
2. THE progress Card SHALL contain Progress component showing processed/total
3. THE progress Card SHALL display pills using Badge: processed/total, eligible, ineligible, pending, errors
4. THE progress Card SHALL display action buttons on the right side
5. THE Promote Button SHALL be disabled when readyToPromote=false
6. WHEN Promote is disabled, THE System SHALL show Tooltip with blockingReasons
7. THE Cancel Button SHALL use variant="destructive" and only appear when status=RUNNING
8. THE Run detail page SHALL use Tabs with tabs: Diff, Errors
9. THE Diff tab SHALL display Card with summary and lists using Accordion or Collapsible
10. THE Errors tab SHALL display ErrorSamplePanel with table and expandable rows via Collapsible

### Requirement 8: Confirm Action Dialogs

**User Story:** As an admin, I want confirmation for dangerous actions, so that I don't accidentally trigger irreversible operations.

#### Acceptance Criteria

1. THE System SHALL use AlertDialog for all confirm actions (Promote, Cancel)
2. THE AlertDialog SHALL display clear description of the action consequences
3. THE AlertDialog SHALL provide Cancel and Confirm buttons
4. THE Promote AlertDialog MAY require typing confirmation text for extra safety
5. THE Cancel AlertDialog SHALL warn about stopping the running evaluation
6. WHEN AlertDialog is confirmed, THE System SHALL show loading state on confirm button

### Requirement 9: Style Guide та Layout Standards

**User Story:** As a frontend developer, I want consistent styling rules, so that all modules look unified.

#### Acceptance Criteria

1. THE System SHALL use consistent grid layout: max-w-6xl mx-auto space-y-6 for all pages
2. THE System SHALL use DataTable for all list views — no custom tables
3. THE System SHALL use DropdownMenu or Button in header for all actions
4. THE System SHALL use AlertDialog for all "danger" actions
5. THE System SHALL use Card as primary container for content sections
6. THE System SHALL use consistent spacing: space-y-4 within cards, space-y-6 between sections
7. THE System SHALL use Skeleton components for loading states

### Requirement 10: Module Extensibility

**User Story:** As a platform architect, I want modular admin structure, so that new modules automatically fit the existing UI style.

#### Acceptance Criteria

1. THE Admin_Module SHALL be a self-contained set of page components
2. THE Admin_Module SHALL use only shared Building_Blocks for UI elements
3. WHEN new module is added (Audit, Jobs, Feature Flags), THE Module SHALL use existing Admin_Shell layout
4. THE Admin_Module SHALL register its navigation items in Sidebar
5. THE System SHALL support lazy loading of module components
6. THE Admin_Module SHALL NOT introduce new base UI components — only domain-specific wrappers

### Requirement 11: Accessibility та Responsiveness

**User Story:** As a user, I want accessible and responsive admin interface, so that I can use it on any device.

#### Acceptance Criteria

1. THE System SHALL maintain shadcn/ui accessibility features (keyboard navigation, ARIA labels, focus management)
2. THE System SHALL support responsive layout: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
3. THE Sidebar SHALL collapse to Sheet on mobile devices
4. THE DataTable SHALL support horizontal scroll on narrow screens
5. THE System SHALL use appropriate touch targets (min 44x44px) on mobile
6. THE System SHALL support dark mode via next-themes integration

### Requirement 12: Toast Notifications

**User Story:** As a user, I want feedback for my actions, so that I know when operations succeed or fail.

#### Acceptance Criteria

1. THE System SHALL use Sonner for all toast notifications
2. WHEN action succeeds, THE System SHALL show success toast with brief message
3. WHEN action fails, THE System SHALL show error toast with error description
4. WHEN long operation starts, THE System SHALL show loading toast that updates on completion
5. THE toast SHALL support action buttons for undo or retry operations
6. THE toast SHALL auto-dismiss after appropriate duration (success: 3s, error: 5s)
