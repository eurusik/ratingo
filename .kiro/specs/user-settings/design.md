# Design Document: User Settings Page

## Overview

Сторінка налаштувань користувача для Ratingo web-client. Реалізується як модуль `settings` в `src/modules/settings/` з використанням існуючих UI компонентів (shadcn/ui), React Hook Form для форм, Zod для валідації та React Query для API взаємодії.

Сторінка доступна за маршрутом `/settings` тільки для авторизованих користувачів. Організована в три таби: Profile, Privacy, Security.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    /settings (page.tsx)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              SettingsPageClient (CSR)                   ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │                   Tabs                              │││
│  │  │  ┌──────────┬──────────────┬───────────────┐       │││
│  │  │  │ Profile  │   Privacy    │   Security    │       │││
│  │  │  └──────────┴──────────────┴───────────────┘       │││
│  │  │                                                     │││
│  │  │  ┌─────────────────────────────────────────────┐   │││
│  │  │  │              TabContent                      │   │││
│  │  │  │  - ProfileSection                            │   │││
│  │  │  │  - PrivacySection                            │   │││
│  │  │  │  - SecuritySection                           │   │││
│  │  │  └─────────────────────────────────────────────┘   │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  AuthContext │────▶│ SettingsPage │────▶│   usersApi   │
│  (user data) │     │  (CSR page)  │     │  (API calls) │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ React Query  │
                     │   (cache)    │
                     └──────────────┘
```

## Components and Interfaces

### Module Structure

```
src/modules/settings/
├── index.ts                    # Public exports
├── schemas.ts                  # Zod validation schemas
├── components/
│   ├── index.ts
│   ├── settings-page-client.tsx    # Main client component
│   ├── profile-section.tsx         # Profile editing form
│   ├── avatar-uploader.tsx         # Avatar upload component
│   ├── privacy-section.tsx         # Privacy toggles
│   ├── security-section.tsx        # Password change form
│   └── settings-skeleton.tsx       # Loading skeleton
└── hooks/
    ├── index.ts
    ├── use-update-profile.ts       # Profile mutation hook
    ├── use-change-password.ts      # Password mutation hook
    └── use-avatar-upload.ts        # Avatar upload hook
```

### API Layer Extension

```typescript
// src/core/api/users.ts
import type { components } from '@ratingo/api-contract';

export type UpdateProfileDto = components['schemas']['UpdateProfileDto'];
export type ChangePasswordDto = components['schemas']['ChangePasswordDto'];
export type CreateAvatarUploadUrlDto = components['schemas']['CreateAvatarUploadUrlDto'];
export type AvatarUploadUrlDto = components['schemas']['AvatarUploadUrlDto'];

export const usersApi = {
  /** Updates current user profile. */
  async updateProfile(data: UpdateProfileDto): Promise<MeDto> {
    return apiPatch<MeDto>('users/me', data);
  },

  /** Changes current user password. */
  async changePassword(data: ChangePasswordDto): Promise<void> {
    return apiPatch<void>('users/me/password', data);
  },

  /** Creates presigned URL for avatar upload. */
  async createAvatarUploadUrl(data: CreateAvatarUploadUrlDto): Promise<AvatarUploadUrlDto> {
    return apiPost<AvatarUploadUrlDto>('users/me/avatar/upload-url', data);
  },
} as const;
```

### Component Interfaces

```typescript
// SettingsPageClient
interface SettingsPageClientProps {
  initialTab?: 'profile' | 'privacy' | 'security';
}

// ProfileSection
interface ProfileSectionProps {
  user: MeDto;
  onSuccess: () => void;
  onUsernameChange?: (newUsername: string, oldUsername: string) => void;
}

// AvatarUploader
interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  onUploadSuccess: (newUrl: string) => void;
}

// PrivacySection
interface PrivacySectionProps {
  user: MeDto;
  onUpdate: (field: keyof UpdateProfileDto, value: boolean) => Promise<void>;
}

// SecuritySection (no props, self-contained)
```

### Validation Schemas

```typescript
// src/modules/settings/schemas.ts
import { z } from 'zod';
import type { getDictionary } from '@/shared/i18n';

type Dict = ReturnType<typeof getDictionary>;

export function createProfileSchema(dict: Dict) {
  return z.object({
    username: z
      .string()
      .min(3, dict.settings.validation.usernameMin)
      .max(20, dict.settings.validation.usernameMax)
      .regex(/^[a-zA-Z0-9_]+$/, dict.settings.validation.usernameFormat),
    bio: z
      .string()
      .max(500, dict.settings.validation.bioMax)
      .optional(),
    location: z
      .string()
      .max(100, dict.settings.validation.locationMax)
      .optional(),
    website: z
      .string()
      .url(dict.settings.validation.websiteInvalid)
      .optional()
      .or(z.literal('')),
    preferredLanguage: z.enum(['uk', 'en']).optional(),
    preferredRegion: z.string().optional(),
  });
}

export function createPasswordSchema(dict: Dict) {
  return z.object({
    currentPassword: z.string().min(1, dict.settings.validation.currentPasswordRequired),
    newPassword: z.string().min(8, dict.settings.validation.passwordMin),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: dict.settings.validation.passwordMismatch,
    path: ['confirmPassword'],
  });
}

export type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;
export type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;
```

## Data Models

### User Profile (from api-contract)

```typescript
// Already defined in @ratingo/api-contract
interface MeDto {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  profile: ProfileDto;
  stats: StatsDto;
}

interface ProfileDto {
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  preferredLanguage: string | null;
  preferredRegion: string | null;
  isProfilePublic: boolean;
  showWatchHistory: boolean;
  showRatings: boolean;
  allowFollowers: boolean;
}

interface UpdateProfileDto {
  username?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  preferredLanguage?: string;
  preferredRegion?: string;
  isProfilePublic?: boolean;
  showWatchHistory?: boolean;
  showRatings?: boolean;
  allowFollowers?: boolean;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
```

### Form State

```typescript
interface SettingsFormState {
  isDirty: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Profile Validation Rejects Invalid Input

*For any* profile form submission with invalid data (username empty/too short/invalid chars, bio > 500 chars, or invalid URL), the form SHALL display validation errors and NOT call the API.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 2: Password Validation Rejects Invalid Input

*For any* password change form submission where new password < 8 characters OR confirm password doesn't match new password, the form SHALL display validation errors and NOT call the API.

**Validates: Requirements 5.2, 5.3**

### Property 3: Avatar File Validation

*For any* selected file with size > 5MB OR invalid MIME type (not image/jpeg, image/png, image/webp), the Avatar_Uploader SHALL display an error and prevent the upload from starting.

**Validates: Requirements 3.3, 3.4, 3.6**

### Property 4: Privacy Toggle Optimistic Update Rollback

*For any* privacy toggle that fails to save, the UI SHALL revert to the previous state within 1 second of receiving the error response.

**Validates: Requirements 4.2, 4.4**

## Error Handling

### Unsaved Changes Logic

**Profile and Security Sections:**
- Track `isDirty` state using React Hook Form
- Show confirmation dialog when navigating away with unsaved changes
- Dialog message: "У вас є незбережені зміни. Ви впевнені, що хочете вийти?"

**Privacy Section:**
- Auto-save on toggle (optimistic update)
- NO unsaved changes warning
- Immediate feedback via toast

**Username Change Confirmation:**
- When username field is modified, show inline warning
- On form submit with changed username, show confirmation dialog:
  - Title: "Зміна імені користувача"
  - Message: "Це змінить URL вашого публічного профілю. Старі посилання перестануть працювати. Продовжити?"
  - Actions: "Скасувати" / "Підтвердити"

### API Errors

| Error Code | User Message | Action |
|------------|--------------|--------|
| 401 | Session expired | Redirect to login |
| 400 (validation) | Field-specific error | Show inline error |
| 409 (username taken) | Username already exists | Show inline error |
| 403 (wrong password) | Current password incorrect | Show inline error only (no toast) |
| 500 | Server error | Show toast, allow retry |

### Client-Side Errors

| Error Type | Handling |
|------------|----------|
| File too large (>5MB) | Show error, prevent upload |
| Invalid MIME type | Show error, prevent upload |
| Network error | Show toast, allow retry |
| Validation error | Show inline field errors |

### File Validation

```typescript
// Avatar file validation
const validateAvatarFile = (file: File): string | null => {
  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5MB
  
  if (!validMimeTypes.includes(file.type)) {
    return dict.settings.errors.invalidFileType;
  }
  
  if (file.size > maxSizeBytes) {
    return dict.settings.errors.fileTooLarge;
  }
  
  return null;
};
```

### Error Recovery

```typescript
// Optimistic update with rollback
const togglePrivacy = async (field: string, value: boolean) => {
  const previousValue = user.profile[field];
  
  // Optimistic update
  setUser({ ...user, profile: { ...user.profile, [field]: value } });
  
  try {
    await usersApi.updateProfile({ [field]: value });
    toast.success(dict.settings.saved);
  } catch (error) {
    // Rollback
    setUser({ ...user, profile: { ...user.profile, [field]: previousValue } });
    toast.error(dict.settings.errors.saveFailed);
  }
};
```

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Schema validation tests** - Test boundary conditions for each field
2. **Component rendering tests** - Verify correct UI states
3. **Hook behavior tests** - Test mutation success/error handling

### Property-Based Tests

Property tests verify universal properties across all inputs using fast-check:

1. **Profile validation property** - Generate random invalid inputs, verify rejection
2. **Password validation property** - Generate random password pairs, verify matching logic
3. **File size validation property** - Generate random file sizes, verify 5MB boundary

**Configuration:**
- Library: fast-check
- Minimum iterations: 100 per property
- Tag format: **Feature: user-settings, Property {N}: {description}**

### Integration Tests

1. **Auth guard test** - Verify redirect for unauthenticated users
2. **Full form submission flow** - Submit valid data, verify API call and success state
3. **Avatar upload flow** - Select file, verify presigned URL request, upload, and UI update

## i18n Extensions

```json
// Add to uk.json
{
  "settings": {
    "title": "Налаштування",
    "tabs": {
      "profile": "Профіль",
      "privacy": "Приватність",
      "security": "Безпека"
    },
    "profile": {
      "title": "Інформація профілю",
      "username": "Імʼя користувача",
      "usernameHint": "Зміна імені вплине на URL вашого профілю",
      "bio": "Про себе",
      "bioPlaceholder": "Розкажіть про себе...",
      "location": "Місцезнаходження",
      "locationPlaceholder": "Київ, Україна",
      "website": "Вебсайт",
      "websitePlaceholder": "https://example.com",
      "language": "Мова",
      "region": "Регіон"
    },
    "avatar": {
      "change": "Змінити фото",
      "uploading": "Завантаження...",
      "maxSize": "Максимум 5 МБ",
      "formats": "JPG, PNG або WebP",
      "squareHint": "Рекомендуємо квадратне зображення для кращого результату"
    },
    "privacy": {
      "title": "Налаштування приватності",
      "publicProfile": "Публічний профіль",
      "publicProfileHint": "Інші користувачі зможуть бачити ваш профіль",
      "privateProfileNote": "Ваш профіль прихований від інших користувачів",
      "showHistory": "Показувати історію переглядів",
      "showRatings": "Показувати мої оцінки",
      "allowFollowers": "Дозволити підписки"
    },
    "security": {
      "title": "Зміна пароля",
      "currentPassword": "Поточний пароль",
      "newPassword": "Новий пароль",
      "confirmPassword": "Підтвердіть пароль",
      "changePassword": "Змінити пароль"
    },
    "validation": {
      "usernameMin": "Мінімум 3 символи",
      "usernameMax": "Максимум 20 символів",
      "usernameFormat": "Тільки латинські букви, цифри та _",
      "bioMax": "Максимум 500 символів",
      "locationMax": "Максимум 100 символів",
      "websiteInvalid": "Невірний формат URL",
      "currentPasswordRequired": "Введіть поточний пароль",
      "passwordMin": "Мінімум 8 символів",
      "passwordMismatch": "Паролі не співпадають"
    },
    "saved": "Збережено",
    "saving": "Збереження...",
    "errors": {
      "saveFailed": "Не вдалося зберегти",
      "uploadFailed": "Не вдалося завантажити фото",
      "wrongPassword": "Невірний поточний пароль",
      "usernameTaken": "Це імʼя вже зайнято",
      "invalidFileType": "Підтримуються тільки JPG, PNG та WebP",
      "fileTooLarge": "Файл занадто великий. Максимум 5 МБ"
    },
    "confirmUsernameChange": {
      "title": "Зміна імені користувача",
      "message": "Це змінить URL вашого публічного профілю. Старі посилання перестануть працювати. Продовжити?",
      "cancel": "Скасувати",
      "confirm": "Підтвердити"
    },
    "unsavedChanges": "У вас є незбережені зміни. Ви впевнені, що хочете вийти?"
  }
}
```

## UI Mockup (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Назад                           Налаштування             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐           │
│  │ Профіль  │ │  Приватність │ │   Безпека     │           │
│  └──────────┘ └──────────────┘ └───────────────┘           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────┐                                             │   │
│  │  │ 👤  │  Змінити фото                              │   │
│  │  └─────┘  JPG, PNG або WebP • Максимум 5 МБ         │   │
│  │                                                      │   │
│  │  Імʼя користувача                                   │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ ratingo_fan                                  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  Зміна імені вплине на URL вашого профілю           │   │
│  │                                                      │   │
│  │  Про себе                                           │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ Люблю фільми жахів та наукову фантастику    │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  Місцезнаходження                                   │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ Київ, Україна                               │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  Вебсайт                                            │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │ https://instagram.com/myprofile             │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │  Мова              Регіон                           │   │
│  │  ┌───────────┐     ┌───────────┐                    │   │
│  │  │ Українська│     │ Україна   │                    │   │
│  │  └───────────┘     └───────────┘                    │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │              Зберегти зміни                  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
