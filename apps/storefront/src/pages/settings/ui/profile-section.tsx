'use client';

import type { FormEvent } from 'react';
import { Button, Form } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import type { ProfileForm } from '../model/profile-form';
import { AvatarBlock } from './avatar-block';
import { ProfileFields } from './profile-fields';

function SaveBar({ form }: { form: ProfileForm }) {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;

  return (
    <>
      <div className="sticky bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom)+1.25rem)] z-10 md:hidden">
        <Button
          type="submit"
          fullWidth
          isDisabled={!form.isDirty}
          isPending={form.isSaving}
          className="h-13 rounded-full text-base font-bold shadow-overlay disabled:bg-default disabled:text-muted disabled:opacity-100"
        >
          {form.isDirty ? copy.save : copy.noChanges}
        </Button>
      </div>
      {form.isDirty ? (
        <div className="sticky bottom-0 z-10 flex items-center gap-2.5 border-t border-separator bg-background py-3 max-md:hidden">
          <p role="status" className="flex-1 text-sm text-warning">
            {copy.unsaved}
          </p>
          <Button variant="outline" className="h-11 rounded-full px-4.5" onPress={form.reset}>
            {copy.cancel}
          </Button>
          <Button
            type="submit"
            isPending={form.isSaving}
            className="h-11 rounded-full px-5.5 font-bold"
          >
            {copy.save}
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function ProfileSection({ form }: { form: ProfileForm }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.save();
  };

  return (
    <Form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-5.5 md:rounded-3xl md:bg-surface md:p-6">
        <AvatarBlock />
        <ProfileFields form={form} />
      </div>
      <SaveBar form={form} />
    </Form>
  );
}
