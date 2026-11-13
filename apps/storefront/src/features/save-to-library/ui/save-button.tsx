'use client';

import type { Key } from 'react';
import { Dropdown, Label, ToggleButton, toast } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import type { MediaSummary } from '@/entities/media';
import { isSaved, useSaveStatus } from '@/entities/library';
import { useSignedInAction } from '@/shared/auth';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useBrowserOrigin } from '@/shared/lib';
import { useLibrarySave } from '../model/library-save';
import { shareLink } from '../model/share-link';

type SaveButtonTone = 'surface' | 'overlay';

const TONE_CLASSES: Record<SaveButtonTone, string> = {
  surface: '',
  overlay: 'bg-black/80 text-white',
};

const MENU_KEYS = { toggle: 'toggle', open: 'open', share: 'share' } as const;

interface SaveButtonProps {
  media: Pick<MediaSummary, 'mediaItemId' | 'title' | 'type' | 'slug'>;
  tone?: SaveButtonTone;
}

export function SaveButton({ media, tone = 'surface' }: SaveButtonProps) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const origin = useBrowserOrigin();
  const runSignedIn = useSignedInAction();
  const { toggleSaved, save } = useLibrarySave();
  const saved = isSaved(useSaveStatus(media.mediaItemId));
  const savable = { mediaItemId: media.mediaItemId, title: media.title };
  const href = mediaRoute(media.type, media.slug);
  const toggleLabel = saved ? dict.saveToLibrary.menu.unsave : dict.saveToLibrary.menu.save;

  const toggleOrAskToSignIn = () => {
    if (isAuthenticated) toggleSaved(savable);
    else runSignedIn(() => save(savable), { kind: 'save', ...savable });
  };

  const share = async () => {
    if (!origin) return;
    const outcome = await shareLink({ url: new URL(href, origin).href, title: media.title });
    if (outcome === 'copied') toast(dict.saveToLibrary.toast.linkCopied);
    if (outcome === 'failed') toast.danger(dict.saveToLibrary.toast.shareFailed);
  };

  const onMenuAction = (key: Key) => {
    if (key === MENU_KEYS.toggle) toggleOrAskToSignIn();
    if (key === MENU_KEYS.share) void share();
  };

  return (
    <Dropdown trigger="longPress">
      <ToggleButton
        isIconOnly
        isSelected={saved}
        onPress={toggleOrAskToSignIn}
        aria-label={interpolate(dict.saveToLibrary.save, { title: media.title })}
        className={`size-11 shrink-0 touch-manipulation rounded-full select-none [-webkit-touch-callout:none] data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground ${TONE_CLASSES[tone]}`}
      >
        {saved ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
      </ToggleButton>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={onMenuAction}>
          <Dropdown.Item id={MENU_KEYS.toggle} textValue={toggleLabel}>
            <Label>{toggleLabel}</Label>
          </Dropdown.Item>
          <Dropdown.Item id={MENU_KEYS.open} href={href} textValue={dict.saveToLibrary.menu.open}>
            <Label>{dict.saveToLibrary.menu.open}</Label>
          </Dropdown.Item>
          <Dropdown.Item id={MENU_KEYS.share} textValue={dict.saveToLibrary.menu.share}>
            <Label>{dict.saveToLibrary.menu.share}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
