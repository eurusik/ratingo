import { PosterTileSkeleton } from './poster-tile';

const GRID_BASE =
  'grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 md:grid-cols-5 md:gap-x-4 md:gap-y-6';

const GRID_COLUMNS = {
  withSidebar: 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  fullWidth: 'lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
} as const;

const SKELETON_TILES = 12;

export function browseGridClass(hasSidebar: boolean): string {
  return `${GRID_BASE} ${GRID_COLUMNS[hasSidebar ? 'withSidebar' : 'fullWidth']}`;
}

export function BrowseGridSkeleton({ hasSidebar }: { hasSidebar: boolean }) {
  return (
    <div aria-hidden className={browseGridClass(hasSidebar)}>
      {Array.from({ length: SKELETON_TILES }, (_, index) => (
        <PosterTileSkeleton key={index} />
      ))}
    </div>
  );
}
