import { createLokiSimulator } from '@ratingo/ai-ops-tools';

import { EVAL_NOW_MS } from './eval-clock';

export const simulatedLokiFetch = createLokiSimulator(EVAL_NOW_MS);
