import { DEFAULT_REGION } from './profile-draft';

const REGION_CODES = [
  'AR',
  'AT',
  'AU',
  'BE',
  'BG',
  'BR',
  'CA',
  'CH',
  'CL',
  'CO',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'HK',
  'HR',
  'HU',
  'ID',
  'IE',
  'IN',
  'IT',
  'JP',
  'KR',
  'LT',
  'LV',
  'MX',
  'MY',
  'NL',
  'NO',
  'NZ',
  'PE',
  'PH',
  'PL',
  'PT',
  'RO',
  'RS',
  'SE',
  'SG',
  'SI',
  'SK',
  'TH',
  'TR',
  'TW',
  'US',
  'ZA',
] as const;

export interface RegionOption {
  code: string;
  name: string;
}

export function regionOptions(locale: string, current: string): RegionOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const toOption = (code: string): RegionOption => ({ code, name: names.of(code) ?? code });
  const others = [...new Set<string>([...REGION_CODES, current])]
    .filter((code) => code !== DEFAULT_REGION)
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return [toOption(DEFAULT_REGION), ...others];
}
