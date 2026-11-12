import { Chip } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { VERDICT_TONES, type RatingVerdict } from '../model/score';

export function VerdictChip({ verdict }: { verdict: RatingVerdict }) {
  const { dict } = useTranslation();

  return (
    <Chip
      size="md"
      variant="soft"
      color={VERDICT_TONES[verdict]}
      className="shrink-0 font-extrabold"
    >
      <span className="sr-only">{dict.rating.verdictLabel} </span>
      {dict.rating.verdict[verdict]}
    </Chip>
  );
}
