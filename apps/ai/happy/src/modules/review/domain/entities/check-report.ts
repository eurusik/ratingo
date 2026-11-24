export const CheckConclusion = {
  NEUTRAL: 'neutral',
} as const;
export type CheckConclusion = (typeof CheckConclusion)[keyof typeof CheckConclusion];

export const AnnotationLevel = {
  NOTICE: 'notice',
  WARNING: 'warning',
} as const;
export type AnnotationLevel = (typeof AnnotationLevel)[keyof typeof AnnotationLevel];

export interface CheckAnnotation {
  path: string;
  line: number;
  level: AnnotationLevel;
  title: string;
  message: string;
}

export interface CheckReport {
  conclusion: typeof CheckConclusion.NEUTRAL;
  title: string;
  summary: string;
  annotations: CheckAnnotation[];
}
