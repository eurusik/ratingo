import { DUME_REQUEST_ID_MIN_DIGITS, DUME_REQUEST_ID_PREFIX } from '../constants/dume.constants';

export const delegationRequestId = (updateId: number): string =>
  `${DUME_REQUEST_ID_PREFIX}${String(updateId).padStart(DUME_REQUEST_ID_MIN_DIGITS, '0')}`;
