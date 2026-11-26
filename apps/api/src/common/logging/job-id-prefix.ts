import type { MessageParser } from '@ratingo/node-telemetry';

const JOB_ID_PREFIX = /^\[job:([^\]]+)\]\s*/;

export const parseJobIdPrefix: MessageParser = (text) => {
  const match = JOB_ID_PREFIX.exec(text);
  if (!match) {
    return { text };
  }
  return { text: text.slice(match[0].length), fields: { job_id: match[1] } };
};
