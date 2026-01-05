// Layout components
export { AdminLayout, AdminShell, Sidebar, SidebarTrigger } from './components/layout';

// UI primitives
export {
  DataTable,
  StatusBadge,
  statusBadgeVariants,
  statusVariantMap,
  EmptyState,
  ErrorState,
  LoadingState,
  JsonViewer,
  FilterBar,
  ProgressWithStats,
  RunStatusCard,
} from './components/ui';

// Dialogs
export {
  ConfirmActionDialog,
  CancelConfirmDialog,
  PromoteConfirmDialog,
} from './components/dialogs';

// Policy feature components
export {
  CountriesCard,
  LanguagesCard,
  ProvidersCard,
  SettingsCard,
  BreakoutRulesCard,
  GlobalRequirementsCard,
  PolicyHeader,
  PolicyRunsTab,
  PolicyConfigTab,
  PolicyEditForm,
  NewPolicyDialog,
  DraftHeader,
  type PolicyFormData,
  type PolicyHeaderLabels,
  type NewPolicyDialogLabels,
} from './components/policy';

// Provider feature components
export {
  MappingDialog,
  UnmappedProvidersTable,
  MappingsTable,
  type MappingDialogProps,
  type MappingFormData,
} from './components/providers';

// Run feature components
export { RunHeader, RunDiffTab, RunErrorsTab } from './components/run';

// Configuration
export { ADMIN_NAVIGATION, getAdminNavigation } from './config';

// Types
export * from './types';
