import { Fragment, type ReactNode } from 'react';

const PLACEHOLDER_SPLIT = /(\{\w+\})/;
const PLACEHOLDER = /^\{(\w+)\}$/;

export function interpolateNodes(template: string, values: Record<string, ReactNode>): ReactNode {
  let offset = 0;
  return template.split(PLACEHOLDER_SPLIT).map((part) => {
    const start = offset;
    offset += part.length;
    const name = PLACEHOLDER.exec(part)?.[1];
    const content = name !== undefined && name in values ? values[name] : part;
    return <Fragment key={start}>{content}</Fragment>;
  });
}
