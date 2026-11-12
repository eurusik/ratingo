import { Check, Circle } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { PASSWORD_RULES, checkPasswordRules } from '../model/password-rules';

export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  const { dict } = useTranslation();
  const results = checkPasswordRules(password);

  return (
    <ul
      id={id}
      aria-label={dict.auth.passwordRules.label}
      className="mt-1 flex flex-col gap-1 text-sm"
    >
      {PASSWORD_RULES.map((rule) => {
        const isMet = results[rule];
        const Icon = isMet ? Check : Circle;
        return (
          <li
            key={rule}
            data-met={isMet}
            className="flex items-center gap-1.5 text-muted data-[met=true]:text-success"
          >
            <Icon aria-hidden className="size-3.5" strokeWidth={2.4} />
            {dict.auth.passwordRules[rule]}
            {isMet ? <span className="sr-only">{`, ${dict.auth.passwordRules.met}`}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
