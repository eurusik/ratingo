let skeletonShownForPath: string | null = null;

export function markSkeletonShownFor(path: string): void {
  skeletonShownForPath = path;
}

export function consumeSkeletonShownFor(path: string): boolean {
  const wasShown = skeletonShownForPath === path;
  skeletonShownForPath = null;
  return wasShown;
}
