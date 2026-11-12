import { useTranslation } from '@/shared/i18n';

export function useScoreFormat(): (score: number) => string {
  const { locale } = useTranslation();
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (score) => format.format(score);
}
