/**
 * Supported regions for watch providers.
 */

export interface Region {
  code: string;
  name: string;
  flag: string;
}

export interface RegionGroup {
  label: string;
  regions: Region[];
}

export const REGION_GROUPS: RegionGroup[] = [
  {
    label: 'Популярні',
    regions: [
      { code: 'UA', name: 'Україна', flag: '🇺🇦' },
      { code: 'US', name: 'United States', flag: '🇺🇸' },
      { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
      { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
      { code: 'PL', name: 'Polska', flag: '🇵🇱' },
    ],
  },
  {
    label: 'Європа',
    regions: [
      { code: 'AT', name: 'Österreich', flag: '🇦🇹' },
      { code: 'BE', name: 'België', flag: '🇧🇪' },
      { code: 'BG', name: 'България', flag: '🇧🇬' },
      { code: 'CH', name: 'Schweiz', flag: '🇨🇭' },
      { code: 'CZ', name: 'Česko', flag: '🇨🇿' },
      { code: 'DK', name: 'Danmark', flag: '🇩🇰' },
      { code: 'EE', name: 'Eesti', flag: '🇪🇪' },
      { code: 'ES', name: 'España', flag: '🇪🇸' },
      { code: 'FI', name: 'Suomi', flag: '🇫🇮' },
      { code: 'FR', name: 'France', flag: '🇫🇷' },
      { code: 'GR', name: 'Ελλάδα', flag: '🇬🇷' },
      { code: 'HR', name: 'Hrvatska', flag: '🇭🇷' },
      { code: 'HU', name: 'Magyarország', flag: '🇭🇺' },
      { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
      { code: 'IT', name: 'Italia', flag: '🇮🇹' },
      { code: 'LT', name: 'Lietuva', flag: '🇱🇹' },
      { code: 'LV', name: 'Latvija', flag: '🇱🇻' },
      { code: 'NL', name: 'Nederland', flag: '🇳🇱' },
      { code: 'NO', name: 'Norge', flag: '🇳🇴' },
      { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
      { code: 'RO', name: 'România', flag: '🇷🇴' },
      { code: 'RS', name: 'Србија', flag: '🇷🇸' },
      { code: 'SE', name: 'Sverige', flag: '🇸🇪' },
      { code: 'SI', name: 'Slovenija', flag: '🇸🇮' },
      { code: 'SK', name: 'Slovensko', flag: '🇸🇰' },
    ],
  },
  {
    label: 'Америка',
    regions: [
      { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
      { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'CL', name: 'Chile', flag: '🇨🇱' },
      { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
      { code: 'MX', name: 'México', flag: '🇲🇽' },
      { code: 'PE', name: 'Perú', flag: '🇵🇪' },
    ],
  },
  {
    label: 'Азія та Океанія',
    regions: [
      { code: 'AU', name: 'Australia', flag: '🇦🇺' },
      { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
      { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
      { code: 'IN', name: 'India', flag: '🇮🇳' },
      { code: 'JP', name: '日本', flag: '🇯🇵' },
      { code: 'KR', name: '한국', flag: '🇰🇷' },
      { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
      { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
      { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
      { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
      { code: 'TH', name: 'ประเทศไทย', flag: '🇹🇭' },
      { code: 'TW', name: '台灣', flag: '🇹🇼' },
    ],
  },
  {
    label: 'Інші',
    regions: [
      { code: 'IL', name: 'ישראל', flag: '🇮🇱' },
      { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
      { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
    ],
  },
];

/** Flat list of all regions. */
export const ALL_REGIONS = REGION_GROUPS.flatMap((g) => g.regions);

/** Get region by code. */
export function getRegionByCode(code: string): Region | undefined {
  return ALL_REGIONS.find((r) => r.code === code);
}
