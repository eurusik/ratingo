'use client';

import { useMemo, type ReactNode } from 'react';
import {
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { findUsernameProblem, type UsernameProblem } from '@/features/authenticate';
import { interpolate, useTranslation } from '@/shared/i18n';
import { PROFILE_ADDRESS_PREFIX } from '../model/account';
import {
  BIO_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  isWebsite,
  type ProfileDraft,
} from '../model/profile-draft';
import type { ProfileForm } from '../model/profile-form';
import { regionOptions } from '../model/regions';

function OptionalLabel({ children }: { children: ReactNode }) {
  const { dict } = useTranslation();
  return (
    <Label>
      {children} <span className="font-medium text-muted">· {dict.settings.profile.optional}</span>
    </Label>
  );
}

function RegionField({ value, onChange }: { value: string; onChange: (region: string) => void }) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.profile;
  const regions = useMemo(() => regionOptions(locale, value), [locale, value]);

  return (
    <Select
      name="region"
      value={value}
      onChange={(region) => {
        if (typeof region === 'string') onChange(region);
      }}
      variant="secondary"
      fullWidth
    >
      <Label>{copy.region}</Label>
      <Select.Trigger className="h-12">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Description>{copy.regionHint}</Description>
      <Select.Popover>
        <ListBox>
          {regions.map((region) => (
            <ListBox.Item key={region.code} id={region.code} textValue={region.name}>
              {region.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function ProfileFields({ form }: { form: ProfileForm }) {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;
  const { draft, change } = form;
  const usernameProblems: Record<UsernameProblem, string> = {
    length: dict.auth.validation.usernameLength,
    format: dict.auth.validation.usernameFormat,
  };
  const field = <Field extends keyof ProfileDraft>(name: Field) => ({
    value: draft[name],
    onChange: (value: ProfileDraft[Field]) => change(name, value),
  });

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4.5">
      <TextField
        name="username"
        autoComplete="off"
        {...field('username')}
        validate={(value) => {
          const problem = findUsernameProblem(value.trim());
          return problem ? usernameProblems[problem] : null;
        }}
        isInvalid={form.isUsernameTaken || undefined}
        fullWidth
      >
        <Label>{copy.username}</Label>
        <InputGroup variant="secondary" fullWidth>
          <InputGroup.Prefix className="text-muted">{PROFILE_ADDRESS_PREFIX}</InputGroup.Prefix>
          <InputGroup.Input className="text-base" spellCheck={false} autoCapitalize="none" />
        </InputGroup>
        <Description>{copy.usernameHint}</Description>
        <FieldError>{form.isUsernameTaken ? copy.usernameTaken : undefined}</FieldError>
      </TextField>
      <RegionField {...field('region')} />
      <TextField
        name="bio"
        autoComplete="off"
        {...field('bio')}
        fullWidth
        className="md:col-span-2"
      >
        <Label>{copy.bio}</Label>
        <TextArea
          variant="secondary"
          rows={3}
          maxLength={BIO_MAX_LENGTH}
          placeholder={copy.bioPlaceholder}
          className="min-h-24 resize-y text-base leading-snug"
        />
        <Description className="self-end tabular-nums">
          {interpolate(copy.bioCount, { count: draft.bio.length, max: BIO_MAX_LENGTH })}
        </Description>
      </TextField>
      <TextField name="location" autoComplete="address-level2" {...field('location')} fullWidth>
        <OptionalLabel>{copy.city}</OptionalLabel>
        <Input
          variant="secondary"
          maxLength={LOCATION_MAX_LENGTH}
          placeholder={copy.cityPlaceholder}
          className="h-12 text-base"
        />
      </TextField>
      <TextField
        name="website"
        autoComplete="url"
        inputMode="url"
        {...field('website')}
        validate={(value) => (isWebsite(value) ? null : copy.websiteInvalid)}
        fullWidth
      >
        <OptionalLabel>{copy.website}</OptionalLabel>
        <Input
          variant="secondary"
          placeholder={copy.websitePlaceholder}
          spellCheck={false}
          autoCapitalize="none"
          className="h-12 text-base"
        />
        <Description>{copy.websiteHint}</Description>
        <FieldError />
      </TextField>
    </div>
  );
}
