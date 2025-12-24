# Implementation Plan: Admin UI Shell

## Overview

Implementation of the Admin UI Shell as a platform foundation for all administrative interfaces. The approach focuses on creating shared building blocks first, then implementing the shell infrastructure, and finally wiring everything together with proper testing coverage.

## Tasks

- [x] 1. Set up project structure and core dependencies
  - Install and configure shadcn/ui components: Button, Card, Table, Dialog, Tabs, Badge, Progress, DropdownMenu, Tooltip, Sheet, Skeleton, Input, Select, Textarea
  - Install lucide-react for icons
  - Install Sonner for toast notifications
  - Set up TypeScript interfaces for core types (RunStatus, PolicyStatus, BlockingReason, ProgressStats)
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 1.1 Write property test for component library consistency
  - **Property 1: Component Library Consistency**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [ ] 2. Implement core Building Blocks components
  - [x] 2.1 Create StatusBadge component
    - Implement thin wrapper around shadcn Badge
    - Add status-to-variant mapping (RUNNING→default, SUCCESS→success, FAILED→destructive, etc.)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 2.2 Write property test for StatusBadge mapping
    - **Property 3: Status Badge Mapping Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8**

  - [x] 2.3 Create DataTable component
    - Implement wrapper around shadcn Table with TanStack Table
    - Add sorting, pagination, and row actions via DropdownMenu
    - Include loading, error, and empty state handling
    - _Requirements: 3.1, 5.3_

  - [x] 2.4 Write property test for DataTable features
    - **Property 4: DataTable Feature Completeness**
    - **Validates: Requirements 3.1, 5.3**

  - [x] 2.5 Create FilterBar component
    - Compose Input, Select, Button, DropdownMenu for list filtering
    - Add debounced search functionality
    - _Requirements: 3.2_

  - [x] 2.6 Create ConfirmActionDialog component
    - Implement wrapper around AlertDialog
    - Add optional typing confirmation for critical actions
    - Include loading state on confirm button
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 2.7 Write property test for dangerous action dialogs
    - **Property 6: Dangerous Action Dialog Consistency**
    - **Validates: Requirements 8.1**

  - [ ]* 2.8 Write property test for typing confirmation
    - **Property 12: Typing Confirmation for Critical Actions**
    - **Validates: Requirements 8.4**

- [x] 3. Implement State Management components
  - [x] 3.1 Create EmptyState component
    - Implement with Card, icon, title, description, and optional action button
    - _Requirements: 3.7_

  - [x] 3.2 Create ErrorState component
    - Implement with error display and retry functionality
    - Support different variants (page, section, inline)
    - _Requirements: Error Handling section_

  - [x] 3.3 Create LoadingState component
    - Implement skeleton, spinner, and progress variants
    - _Requirements: 9.7_

- [ ] 4. Checkpoint - Ensure building blocks work correctly
  - Ensure all building block components render properly
  - Verify TypeScript interfaces are correctly defined
  - Ask the user if questions arise

- [x] 5. Implement Admin Shell layout infrastructure
  - [x] 5.1 Create AdminShell component
    - Implement responsive layout with max-w-6xl mx-auto space-y-6
    - Add Header with breadcrumbs and actions
    - Add Content area for module rendering
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 9.1_

  - [ ]* 5.2 Write property test for layout consistency
    - **Property 2: Layout Container Consistency**
    - **Validates: Requirements 2.6, 9.1**

  - [x] 5.3 Create Sidebar navigation component
    - Implement responsive sidebar (Sheet on mobile, fixed on desktop)
    - Add navigation items with Button variant="ghost"
    - Support active state based on current route
    - Include permissions-based visibility
    - _Requirements: 2.1, 2.2, 2.5, 11.3_

  - [ ]* 5.4 Write property test for navigation consistency
    - **Property 5: Navigation Button Consistency**
    - **Validates: Requirements 2.2**

  - [ ]* 5.5 Write property test for responsive sidebar
    - **Property 8: Responsive Sidebar Behavior**
    - **Validates: Requirements 11.3**

- [x] 6. Implement Module Registration system
  - [x] 6.1 Create module registration interfaces
    - Define AdminModule, ModuleConfig, NavigationItem types
    - Implement module lazy loading support
    - _Requirements: 10.1, 10.4, 10.5_

  - [x] 6.2 Create module boundary enforcement
    - Implement checks for Building Block usage only
    - _Requirements: 10.2, 10.6_

  - [ ]* 6.3 Write property test for module compliance
    - **Property 9: Module Building Block Compliance**
    - **Validates: Requirements 10.2**

- [ ] 7. Implement Toast notification system
  - [ ] 7.1 Set up Sonner integration
    - Configure toast notifications with proper timing
    - Add success (3s), error (5s) auto-dismiss
    - Support action buttons for undo/retry
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 7.2 Write property test for toast consistency
    - **Property 10: Toast Notification Consistency**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**

- [ ] 8. Implement accessibility and responsive features
  - [ ] 8.1 Add accessibility support
    - Ensure keyboard navigation works across all components
    - Verify ARIA labels and focus management
    - Test screen reader compatibility
    - _Requirements: 11.1_

  - [ ]* 8.2 Write property test for accessibility features
    - **Property 11: Accessibility Feature Preservation**
    - **Validates: Requirements 11.1**

  - [ ] 8.3 Implement responsive behavior
    - Ensure DataTable horizontal scroll on narrow screens
    - Verify touch targets (min 44x44px) on mobile
    - Test responsive layout breakpoints
    - _Requirements: 11.2, 11.4, 11.5_

  - [ ] 8.4 Add dark mode support
    - Integrate next-themes for dark mode
    - _Requirements: 11.6_

- [ ] 9. Implement tooltip system for disabled actions
  - [ ] 9.1 Create tooltip wrapper for disabled buttons
    - Show blocking reasons when actions are disabled
    - _Requirements: 7.5_

  - [ ]* 9.2 Write property test for disabled action tooltips
    - **Property 7: Tooltip on Disabled Actions**
    - **Validates: Requirements 7.5**

- [ ] 10. Create example admin pages (Policies and Runs)
  - [ ] 10.1 Implement Policies List page
    - Use DataTable with Name, Version, Active, UpdatedAt columns
    - Add row actions (View, Prepare) via DropdownMenu
    - Include FilterBar for active status filtering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 10.2 Implement Policy Detail page
    - Use Tabs component with Runs and Policy tabs
    - Display runs DataTable with Status, Progress, dates
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 10.3 Implement Run Detail page
    - Create progress Card with ProgressWithStats
    - Add Promote/Cancel buttons with proper disabled states
    - Use Tabs for Diff and Errors sections
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

- [ ]* 10.4 Write unit tests for example pages
  - Test page rendering and user interactions
  - Test navigation between pages
  - Test error states and loading states

- [ ] 11. Final integration and wiring
  - [ ] 11.1 Wire all components together in AdminShell
    - Connect navigation to routing
    - Integrate toast notifications
    - Set up error boundaries
    - _Requirements: All integration requirements_

  - [ ] 11.2 Add error boundary implementation
    - Implement component, page, and module level error boundaries
    - Add fallback UI with retry options
    - _Requirements: Error Handling section_

  - [ ] 11.3 Test module lazy loading
    - Verify modules load correctly
    - Test error handling for failed module loads
    - _Requirements: 10.5_

- [ ]* 11.4 Write integration tests
  - Test cross-component communication
  - Test module registration and loading
  - Test error boundary behavior

- [ ] 12. Final checkpoint - Comprehensive testing
  - Ensure all property tests pass
  - Verify responsive behavior across breakpoints
  - Test accessibility with keyboard navigation
  - Validate toast notifications work correctly
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Building blocks are implemented first to ensure reusability
- Example pages demonstrate proper usage of the platform