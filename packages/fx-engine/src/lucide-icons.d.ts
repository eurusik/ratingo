declare module 'lucide-react/dist/esm/icons/star.js' {
  export const __iconNode: [string, Record<string, string | number>][];
}

declare module 'lucide-react/dist/esm/icons/shield.js' {
  export const __iconNode: [string, Record<string, string | number>][];
}

declare module 'lucide-react/dist/esm/icons/ribbon.js' {
  export const __iconNode: [string, Record<string, string | number>][];
}

declare module 'lucide-react/dist/esm/icons/trophy.js' {
  export const __iconNode: [string, Record<string, string | number>][];
}

declare module 'lucide-react/dynamicIconImports.mjs' {
  const dynamicIconImports: Record<
    string,
    () => Promise<{ __iconNode?: [string, Record<string, string | number>][] }>
  >;
  export default dynamicIconImports;
}
