import { respondWithBrowsePage } from '@/pages/browse';

interface BrowseRouteContext {
  params: Promise<{ category: string }>;
}

export async function GET(request: Request, { params }: BrowseRouteContext) {
  const { category } = await params;
  return respondWithBrowsePage(request, category);
}
