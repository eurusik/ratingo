# Requirements Document

## Introduction

Сторінка налаштувань користувача для веб-додатку Ratingo. Дозволяє авторизованим користувачам керувати своїм профілем, налаштуваннями приватності, змінювати пароль та завантажувати аватар. Сторінка має відповідати існуючому темному дизайну додатку та використовувати shadcn/ui компоненти.

## Glossary

- **Settings_Page**: Сторінка налаштувань користувача за маршрутом `/settings`
- **Profile_Section**: Секція редагування основної інформації профілю (username, bio, location, website)
- **Privacy_Section**: Секція налаштувань приватності (публічність профілю, видимість історії, рейтингів)
- **Security_Section**: Секція безпеки (зміна пароля)
- **Avatar_Uploader**: Компонент для завантаження та попереднього перегляду аватара
- **Settings_Form**: Форма з валідацією для редагування налаштувань
- **User**: Авторизований користувач системи

## Requirements

### Requirement 1: Доступ до сторінки налаштувань

**User Story:** As a User, I want to access my settings page, so that I can manage my account preferences.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to `/settings`, THE Settings_Page SHALL redirect to the home page and show auth modal
2. WHEN an authenticated user navigates to `/settings`, THE Settings_Page SHALL display the settings interface with user's current data
3. THE Settings_Page SHALL display a loading skeleton WHILE user data is being fetched
4. IF the API returns an error WHILE fetching user data, THEN THE Settings_Page SHALL display an error message with retry option

### Requirement 2: Редагування профілю

**User Story:** As a User, I want to edit my profile information, so that I can personalize my public presence.

#### Acceptance Criteria

1. THE Profile_Section SHALL display editable fields for: username, bio, location, website
2. WHEN a user modifies profile fields and submits, THE Settings_Form SHALL validate input before sending to API
3. WHEN username is invalid (empty, too short, or contains invalid characters), THE Settings_Form SHALL display a validation error
4. WHEN bio exceeds 500 characters, THE Settings_Form SHALL display a validation error
5. WHEN website URL is invalid, THE Settings_Form SHALL display a validation error
6. WHEN profile update succeeds, THE Settings_Page SHALL display a success toast notification
7. IF profile update fails, THEN THE Settings_Page SHALL display an error toast with the error message
8. THE Profile_Section SHALL show the current username with a note that changing it affects the public profile URL
9. WHEN username is modified, THE Profile_Section SHALL display an inline warning that this will change the public profile URL
10. WHEN a user submits a form with modified username, THE Settings_Form SHALL show a confirmation dialog before proceeding

### Requirement 3: Завантаження аватара

**User Story:** As a User, I want to upload a profile picture, so that my profile is more recognizable.

#### Acceptance Criteria

1. THE Avatar_Uploader SHALL display the current avatar or a default placeholder
2. WHEN a user clicks on the avatar area, THE Avatar_Uploader SHALL open a file picker for images (jpeg, png, webp)
3. WHEN a user selects a file, THE Avatar_Uploader SHALL validate MIME type (image/jpeg, image/png, image/webp) before proceeding
4. WHEN a user selects a file with invalid MIME type, THE Avatar_Uploader SHALL display an error and prevent upload
5. WHEN a user selects an image, THE Avatar_Uploader SHALL display a preview before upload
6. WHEN the selected image exceeds 5MB, THE Avatar_Uploader SHALL display an error and prevent upload
7. THE Avatar_Uploader SHALL display a hint recommending square images for best results
8. WHEN upload is in progress, THE Avatar_Uploader SHALL display a loading indicator
9. WHEN avatar upload succeeds, THE Avatar_Uploader SHALL update the displayed avatar and show success toast
10. IF avatar upload fails, THEN THE Avatar_Uploader SHALL display an error toast and revert to previous avatar

### Requirement 4: Налаштування приватності

**User Story:** As a User, I want to control my privacy settings, so that I can decide what information is visible to others.

#### Acceptance Criteria

1. THE Privacy_Section SHALL display toggle switches for: isProfilePublic, showWatchHistory, showRatings, allowFollowers
2. WHEN a user toggles a privacy setting, THE Settings_Form SHALL immediately save the change (optimistic update)
3. WHEN isProfilePublic is disabled, THE Privacy_Section SHALL display a note that profile will be hidden from public
4. IF privacy update fails, THEN THE Settings_Page SHALL revert the toggle and display an error toast

### Requirement 5: Зміна пароля

**User Story:** As a User, I want to change my password, so that I can maintain account security.

#### Acceptance Criteria

1. THE Security_Section SHALL display fields for: current password, new password, confirm new password
2. WHEN new password is less than 8 characters, THE Settings_Form SHALL display a validation error
3. WHEN confirm password does not match new password, THE Settings_Form SHALL display a validation error
4. WHEN password change succeeds, THE Security_Section SHALL clear all password fields and show success toast
5. IF current password is incorrect, THEN THE Security_Section SHALL display an inline error message on the current password field without showing a global toast
6. IF password change fails for other reasons (network, server error), THEN THE Security_Section SHALL display an error toast

### Requirement 6: Налаштування мови та регіону

**User Story:** As a User, I want to set my preferred language and region, so that I see relevant content.

#### Acceptance Criteria

1. THE Profile_Section SHALL display select dropdowns for: preferredLanguage, preferredRegion
2. WHEN a user changes language preference, THE Settings_Form SHALL save the change
3. THE preferredLanguage dropdown SHALL include options: uk (Українська), en (English)
4. THE preferredRegion dropdown SHALL include common region codes (UA, US, GB, etc.)

### Requirement 7: Навігація та UX

**User Story:** As a User, I want intuitive navigation within settings, so that I can easily find what I need.

#### Acceptance Criteria

1. THE Settings_Page SHALL organize settings into tabs or sections: Profile, Privacy, Security
2. WHEN a user has unsaved changes in Profile_Section or Security_Section and tries to navigate away, THE Settings_Page SHALL display an unsaved changes warning
3. WHEN a user toggles privacy settings in Privacy_Section, THE Settings_Page SHALL NOT display unsaved changes warning (auto-save behavior)
4. THE Settings_Page SHALL be responsive and work on mobile devices
5. THE Settings_Page SHALL follow the existing dark theme design of the application
6. WHEN any form is submitting, THE Settings_Form SHALL disable submit button and show loading state
