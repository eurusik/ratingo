# Implementation Plan: User Settings Page

## Overview

Реалізація сторінки налаштувань користувача як модуль `settings` в Next.js App Router з використанням shadcn/ui, React Hook Form, Zod валідації та React Query. Сторінка організована в три таби (Profile, Privacy, Security) з підтримкою оптимістичних оновлень, валідації та error handling.

## Tasks

- [ ] 1. Створити базову структуру модуля та схеми валідації
  - Створити директорію `src/modules/settings/` з підпапками `components/` та `hooks/`
  - Створити `schemas.ts` з Zod схемами для profile та password форм
  - Створити index файли для експортів
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 5.2, 5.3_

- [ ]* 1.1 Написати property test для profile validation schema
  - **Property 1: Profile Validation Rejects Invalid Input**
  - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

- [ ]* 1.2 Написати property test для password validation schema
  - **Property 2: Password Validation Rejects Invalid Input**
  - **Validates: Requirements 5.2, 5.3**

- [ ] 2. Розширити API layer для user operations
  - Додати типи з api-contract: `UpdateProfileDto`, `ChangePasswordDto`, `CreateAvatarUploadUrlDto`, `AvatarUploadUrlDto`
  - Реалізувати `usersApi.updateProfile()`, `usersApi.changePassword()`, `usersApi.createAvatarUploadUrl()`
  - _Requirements: 2.6, 2.7, 3.6, 5.4, 5.5, 5.6_

- [ ]* 2.1 Написати unit tests для API methods
  - Тестувати success та error scenarios
  - _Requirements: 2.6, 2.7, 5.4_

- [ ] 3. Створити React Query hooks для mutations
  - Реалізувати `use-update-profile.ts` з оптимістичним оновленням
  - Реалізувати `use-change-password.ts` з error handling
  - Реалізувати `use-avatar-upload.ts` з presigned URL flow
  - _Requirements: 2.6, 2.7, 4.2, 4.4, 5.4, 5.5_

- [ ]* 3.1 Написати unit tests для mutation hooks
  - Тестувати optimistic updates та rollback
  - _Requirements: 4.2, 4.4_

- [ ] 4. Реалізувати Avatar Uploader компонент
  - Створити `avatar-uploader.tsx` з file picker
  - Додати MIME type та file size validation
  - Реалізувати preview перед upload
  - Додати loading state та error handling
  - Додати hint про square images
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.10_

- [ ]* 4.1 Написати property test для file validation
  - **Property 3: Avatar File Validation**
  - **Validates: Requirements 3.3, 3.4, 3.6**

- [ ]* 4.2 Написати unit tests для Avatar Uploader
  - Тестувати file selection, preview, upload flow
  - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

- [ ] 5. Checkpoint - Переконатися що базові компоненти працюють
  - Переконатися що всі тести проходять, запитати користувача якщо виникають питання

- [ ] 6. Реалізувати Profile Section компонент
  - Створити `profile-section.tsx` з React Hook Form
  - Додати поля: username, bio, location, website, preferredLanguage, preferredRegion
  - Інтегрувати Avatar Uploader
  - Реалізувати isDirty tracking для unsaved changes warning
  - Додати inline warning при зміні username
  - Додати confirmation dialog для username change
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 6.1, 6.2, 7.2_

- [ ]* 6.1 Написати unit tests для Profile Section
  - Тестувати form submission, validation errors, username confirmation
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.9, 2.10_

- [ ] 7. Реалізувати Privacy Section компонент
  - Створити `privacy-section.tsx` з toggle switches
  - Додати toggles: isProfilePublic, showWatchHistory, showRatings, allowFollowers
  - Реалізувати optimistic updates з rollback на error
  - Додати note коли isProfilePublic вимкнено
  - БЕЗ unsaved changes warning (auto-save)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.3_

- [ ]* 7.1 Написати property test для optimistic update rollback
  - **Property 4: Privacy Toggle Optimistic Update Rollback**
  - **Validates: Requirements 4.2, 4.4**

- [ ]* 7.2 Написати unit tests для Privacy Section
  - Тестувати toggle behavior, optimistic updates
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 8. Реалізувати Security Section компонент
  - Створити `security-section.tsx` з password change form
  - Додати поля: currentPassword, newPassword, confirmPassword
  - Реалізувати isDirty tracking для unsaved changes warning
  - Додати inline-only error для wrong password (БЕЗ toast)
  - Очищати поля після успішної зміни
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.2_

- [ ]* 8.1 Написати unit tests для Security Section
  - Тестувати password validation, error handling, field clearing
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Створити Settings Page Client компонент
  - Створити `settings-page-client.tsx` з tabs (Profile, Privacy, Security)
  - Інтегрувати всі section компоненти
  - Реалізувати unsaved changes warning для Profile/Security (НЕ для Privacy)
  - Додати loading skeleton
  - Додати error state з retry option
  - _Requirements: 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 9.1 Написати unit tests для Settings Page Client
  - Тестувати tab navigation, unsaved changes logic
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 10. Створити server page та auth guard
  - Створити `app/(authenticated)/settings/page.tsx`
  - Додати auth guard (redirect для unauthenticated users)
  - Інтегрувати SettingsPageClient
  - _Requirements: 1.1, 1.2_

- [ ]* 10.1 Написати integration test для auth guard
  - Тестувати redirect для unauthenticated users
  - _Requirements: 1.1_

- [ ] 11. Додати i18n translations
  - Додати всі тексти до `uk.json` та `en.json`
  - Включити validation messages, errors, confirmations
  - _Requirements: 2.8, 3.7, 6.3_

- [ ] 12. Checkpoint - Переконатися що всі тести проходять
  - Переконатися що всі тести проходять, запитати користувача якщо виникають питання

- [ ]* 13. Написати integration tests для повних flows
  - Тестувати profile update flow end-to-end
  - Тестувати avatar upload flow end-to-end
  - Тестувати password change flow end-to-end
  - _Requirements: 2.6, 3.6, 5.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Unsaved changes warning: тільки для Profile/Security, НЕ для Privacy
- Wrong password error: inline-only, БЕЗ toast
- Username change: inline warning + confirmation dialog
- Avatar validation: MIME type + file size + square hint
