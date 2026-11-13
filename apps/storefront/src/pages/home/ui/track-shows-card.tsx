'use client';

import { Button, Card } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { openSearch } from '@/features/search';
import { openAuth } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';

export function TrackShowsCard() {
  const { dict } = useTranslation();
  const { user, isLoading } = useAuth();
  const copy = dict.home.track;

  if (isLoading || user) return null;

  return (
    <div className="px-4 md:px-0">
      <Card className="gap-3 rounded-3xl p-5 md:max-w-2xl md:p-6">
        <Card.Header className="gap-1.5 p-0">
          <Card.Title className="text-xl font-extrabold tracking-tight">{copy.title}</Card.Title>
          <Card.Description className="text-sm">{copy.body}</Card.Description>
        </Card.Header>
        <Card.Footer className="flex flex-wrap gap-2 p-0">
          <Button className="min-h-tap" onPress={() => openAuth({ mode: 'login' })}>
            {copy.signIn}
          </Button>
          <Button className="min-h-tap" variant="secondary" onPress={openSearch}>
            {copy.find}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
