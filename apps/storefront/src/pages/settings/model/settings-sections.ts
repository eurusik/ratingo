import {
  IMPORT_ROUTE,
  NOTIFICATION_SETTINGS_ROUTE,
  PRIVACY_SETTINGS_ROUTE,
  PROFILE_SETTINGS_ROUTE,
  SECURITY_SETTINGS_ROUTE,
} from '@/shared/config';

export const SETTINGS_SECTIONS = [
  'profile',
  'security',
  'notifications',
  'privacy',
  'import',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SECTION_ROUTES: Record<SettingsSection, string> = {
  profile: PROFILE_SETTINGS_ROUTE,
  security: SECURITY_SETTINGS_ROUTE,
  notifications: NOTIFICATION_SETTINGS_ROUTE,
  privacy: PRIVACY_SETTINGS_ROUTE,
  import: IMPORT_ROUTE,
};
