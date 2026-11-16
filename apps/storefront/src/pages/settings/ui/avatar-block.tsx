'use client';

import { useRef, type DragEvent } from 'react';
import { Avatar, Button } from '@heroui/react';
import { initialOf } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';
import { useAccount } from '../model/account';
import { useAvatarEditor } from '../model/avatar-editor';
import { AVATAR_ACCEPT } from '../model/avatar-file';

export function AvatarBlock() {
  const { dict } = useTranslation();
  const copy = dict.settings.profile;
  const user = useAccount();
  const avatar = useAvatarEditor();
  const fileInput = useRef<HTMLInputElement>(null);

  const takeFile = (file: File | undefined) => {
    if (file) avatar.change(file);
  };

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    takeFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      className="flex flex-col items-center gap-2.5 md:flex-row md:gap-4.5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFile}
    >
      <Avatar className="size-24 rounded-full text-[38px] font-extrabold md:size-22 md:text-[34px]">
        {avatar.imageUrl ? <Avatar.Image src={avatar.imageUrl} alt="" /> : null}
        <Avatar.Fallback>{initialOf(user.username)}</Avatar.Fallback>
      </Avatar>
      <div className="flex flex-col items-center gap-2 md:items-start">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="phone-tap-target rounded-full"
            isPending={avatar.isBusy}
            onPress={() => fileInput.current?.click()}
          >
            {copy.photoChange}
          </Button>
          {avatar.imageUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="phone-tap-target rounded-full text-danger"
              isDisabled={avatar.isBusy}
              onPress={avatar.remove}
            >
              {copy.photoRemove}
            </Button>
          ) : null}
        </div>
        <p className="text-center text-xs text-muted md:text-start">
          {copy.photoHint} <span className="max-md:hidden">{copy.photoDropHint}</span>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept={AVATAR_ACCEPT}
          hidden
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            takeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
