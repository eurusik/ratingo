/**
 * Quick pitch: "Коротко" + "Підійде якщо подобається".
 *
 * SERVER COMPONENT
 */

import type { getDictionary } from '@/shared/i18n';

export interface DetailsQuickPitchProps {
  pitch: string;
  suitableFor?: string[];
  dict: ReturnType<typeof getDictionary>;
}

export function DetailsQuickPitch({ pitch, suitableFor, dict }: DetailsQuickPitchProps) {

  return (
    <section className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-400 mb-2">
        {dict.details.quickPitch.title}
      </h2>
      <p className="text-white leading-relaxed mb-3">
        {pitch}
      </p>
      {suitableFor && suitableFor.length > 0 && (
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-500">{dict.details.quickPitch.suitable}:</span>{' '}
          <span className="text-zinc-300">{suitableFor.join(', ')}</span>
        </p>
      )}
    </section>
  );
}
