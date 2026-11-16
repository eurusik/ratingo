'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button, Form, toast } from '@heroui/react';
import { PasswordChecklist, PasswordField, isStrongPassword } from '@/features/authenticate';
import { useTranslation } from '@/shared/i18n';
import { isWrongPassword, useChangePassword } from '../model/password-change';

export function PasswordForm({ id, onClose }: { id: string; onClose: () => void }) {
  const { dict } = useTranslation();
  const copy = dict.settings.security;
  const checklistId = useId();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isWrong, setIsWrong] = useState(false);
  const change = useChangePassword();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast(copy.passwordChanged);
          onClose();
        },
        onError: (error) => {
          if (isWrongPassword(error)) {
            setIsWrong(true);
            return;
          }
          console.error('Changing the password failed', { error });
          toast.danger(copy.passwordFailed);
        },
      },
    );
  };

  return (
    <Form
      id={id}
      onSubmit={submit}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-[20px] bg-surface p-4 md:grid md:grid-cols-2 md:items-start md:gap-x-5 md:gap-y-4 md:rounded-3xl md:p-6"
    >
      <h3 id={`${id}-title`} className="text-[17px] font-extrabold md:col-span-2">
        {copy.newPasswordTitle}
      </h3>
      <PasswordField
        autoComplete="current-password"
        name="current-password"
        label={copy.currentPassword}
        value={currentPassword}
        onChange={(value) => {
          setCurrentPassword(value);
          setIsWrong(false);
        }}
        validate={(value) => (value ? null : copy.currentRequired)}
        errorMessage={isWrong ? copy.wrongPassword : null}
      />
      <PasswordField
        autoComplete="new-password"
        name="new-password"
        label={copy.newPassword}
        value={newPassword}
        onChange={setNewPassword}
        validate={(value) => (isStrongPassword(value) ? null : dict.auth.validation.passwordWeak)}
        describedBy={checklistId}
      >
        <PasswordChecklist id={checklistId} password={newPassword} />
      </PasswordField>
      <div className="flex gap-2.5 md:col-span-2 md:justify-end">
        <Button variant="outline" className="rounded-full max-md:hidden" onPress={onClose}>
          {copy.cancel}
        </Button>
        <Button
          type="submit"
          isPending={change.isPending}
          className="rounded-full max-md:h-12 max-md:flex-1"
        >
          {copy.changePassword}
        </Button>
      </div>
    </Form>
  );
}
