'use client';

import { useState } from 'react';
import { Button, Dropdown, Label, Skeleton, toast } from '@heroui/react';
import { SpikeSection } from './spike-section';

const SIMULATED_SAVE_MS = 1200;

function simulateSave(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SIMULATED_SAVE_MS);
  });
}

export function FeedbackSection() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SpikeSection id="feedback" title="Відгук і меню">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onPress={() => toast.success('Додано до збереженого')}>
          Toast
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            toast.promise(simulateSave, {
              loading: 'Зберігаємо…',
              success: 'Збережено',
              error: 'Не вдалося зберегти',
            });
          }}
        >
          Toast з промісом
        </Button>
        <Dropdown>
          <Button variant="secondary">Дії</Button>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => toast(`Дія: ${String(key)}`)}>
              <Dropdown.Item id="save" textValue="Зберегти">
                <Label>Зберегти</Label>
              </Dropdown.Item>
              <Dropdown.Item id="share" textValue="Поділитися">
                <Label>Поділитися</Label>
              </Dropdown.Item>
              <Dropdown.Item id="hide" textValue="Приховати" variant="danger">
                <Label>Приховати</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <Button variant="ghost" onPress={() => setIsLoading((current) => !current)}>
          {isLoading ? 'Показати контент' : 'Показати скелетон'}
        </Button>
      </div>

      <div className="flex items-center gap-3" aria-busy={isLoading}>
        {isLoading ? (
          <>
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          </>
        ) : (
          <>
            <div className="size-12 rounded-xl bg-accent" />
            <div className="flex flex-col">
              <span className="font-medium">Сьоґун</span>
              <span className="text-sm text-muted">Серіал, 2024</span>
            </div>
          </>
        )}
      </div>
    </SpikeSection>
  );
}
