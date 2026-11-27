import { DUME_REQUEST_ID_PREFIX } from '../constants/dume.constants';

export const delegationRequestId = (updateId: number): string =>
  `${DUME_REQUEST_ID_PREFIX}${updateId}`;
