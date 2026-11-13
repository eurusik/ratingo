import { useEffect, useState } from 'react';
import { isOnLightConnection, whenIdle } from '@/shared/lib';

export const loadAuthDialog = () =>
  import('@/features/authenticate').then((module) => module.AuthDialog);

export const loadSearchDialog = () =>
  import('@/features/search').then((module) => module.SearchDialog);

export const loadSaveButton = () =>
  import('@/features/save-to-library').then((module) => module.SaveButton);

export const loadPendingSaveReplay = () =>
  import('@/features/save-to-library').then((module) => module.PendingSaveReplay);

const ignoreFailedPreload = () => undefined;

export function useWarmOverlays(): boolean {
  const [isWarm, setIsWarm] = useState(false);

  useEffect(() => {
    if (isOnLightConnection()) return;
    return whenIdle(() => {
      void loadSaveButton().catch(ignoreFailedPreload);
      void Promise.all([loadSearchDialog(), loadAuthDialog()])
        .then(() => setIsWarm(true))
        .catch(ignoreFailedPreload);
    });
  }, []);

  return isWarm;
}
