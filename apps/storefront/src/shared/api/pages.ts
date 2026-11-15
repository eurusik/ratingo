const MAX_PAGES = 20;

interface Page<T> {
  data: T[];
  meta: { hasMore?: boolean };
}

export async function fetchAllPages<T>(
  pageSize: number,
  load: (query: { limit: number; offset: number }) => Promise<Page<T>>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, meta } = await load({ limit: pageSize, offset: page * pageSize });
    items.push(...data);
    if (!meta.hasMore) break;
  }
  return items;
}
