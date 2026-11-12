'use client';

import { useState } from 'react';
import { Button, Sheet } from '@heroui/react';
import { ViewportBottomFill } from '@ratingo/ui/overlay';

const SHEET_SNAP_POINTS = ['45%', '90%'];
const EPISODE_COUNT = 24;
const EPISODE_NUMBERS = Array.from({ length: EPISODE_COUNT }, (_, index) => index + 1);

export function EpisodesSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet snapPoints={SHEET_SNAP_POINTS} isOpen={isOpen} onOpenChange={setIsOpen}>
      {isOpen ? <ViewportBottomFill tone="panel" /> : null}
      <Sheet.Trigger>
        <Button variant="secondary">Sheet зі snap points</Button>
      </Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.CloseTrigger aria-label="Закрити" />
            <Sheet.Header>
              <Sheet.Heading>Епізоди</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <ol className="flex flex-col gap-3">
                {EPISODE_NUMBERS.map((episode) => (
                  <li key={episode} className="rounded-xl bg-surface-secondary p-3">
                    Епізод {episode}
                  </li>
                ))}
              </ol>
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
