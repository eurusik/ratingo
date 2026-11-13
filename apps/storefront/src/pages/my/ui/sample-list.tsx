'use client';

import { useCallback, useState } from 'react';
import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { PullToRefresh, SwipeableRow } from '@/shared/ui/gestures';

const SAMPLE_COUNT = 12;
const SAMPLE_REFRESH_MS = 800;
const SAMPLE_IDS = Array.from({ length: SAMPLE_COUNT }, (_, index) => index + 1);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function SampleList() {
  const { dict } = useTranslation();
  const [ids, setIds] = useState(SAMPLE_IDS);

  const restoreAll = useCallback(async () => {
    await wait(SAMPLE_REFRESH_MS);
    setIds(SAMPLE_IDS);
  }, []);

  return (
    <PullToRefresh onRefresh={restoreAll}>
      <p className="muted px-4 pb-4 md:px-0">{dict.my.sampleHint}</p>
      <ul className="border-y border-separator">
        {ids.map((id) => (
          <li key={id} className="border-b border-separator last:border-b-0">
            <SwipeableRow
              actions={
                <Button
                  variant="danger"
                  className="h-full min-h-tap rounded-none px-6"
                  onPress={() => setIds((current) => current.filter((item) => item !== id))}
                >
                  {dict.my.remove}
                </Button>
              }
            >
              <div className="flex min-h-14 items-center px-4 md:px-0">
                {dict.my.sampleItem.replace('{number}', String(id))}
              </div>
            </SwipeableRow>
          </li>
        ))}
      </ul>
    </PullToRefresh>
  );
}
