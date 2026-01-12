import type { Metadata } from 'next';
import { getDictionary } from '@/shared/i18n';

const dict = getDictionary('uk');

const GITHUB_URL = 'https://github.com/eurusik/ratingo';

export const metadata: Metadata = {
  title: dict.about.meta.title,
  description: dict.about.meta.description,
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-foreground mb-8">{dict.about.title}</h1>

      <div className="prose prose-invert prose-zinc max-w-none">
        <p className="text-muted-foreground leading-relaxed text-lg mb-6">{dict.about.intro}</p>

        <p className="text-muted-foreground leading-relaxed mb-6">{dict.about.problem}</p>

        <p className="text-muted-foreground leading-relaxed mb-8">{dict.about.solution}</p>

        <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">{dict.about.whyTitle}</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">{dict.about.whyText}</p>

        <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
          {dict.about.whatYouGetTitle}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">{dict.about.whatYouGetText}</p>

        <h2 className="text-xl font-semibold text-foreground mt-10 mb-4">
          {dict.about.whyIMadeItTitle}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">{dict.about.whyIMadeItText}</p>
        <p className="text-muted-foreground leading-relaxed font-medium mb-10">
          {dict.about.whyIMadeItConclusion}
        </p>
      </div>
    </div>
  );
}
