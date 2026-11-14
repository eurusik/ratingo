import { reportNavigationStep } from './navigation-debug';

const GROUP_PREFIX = '::view-transition-group(';
const ROOT_GROUP = `${GROUP_PREFIX}root)`;
const MAX_ASPECT_DRIFT = 0.08;

interface GroupBox {
  transform: string;
  width: number;
  height: number;
}

function groupAnimationsOf(root: Element): Animation[] {
  return root.getAnimations({ subtree: true }).filter((animation) => {
    const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? '';
    return pseudo.startsWith(GROUP_PREFIX) && pseudo !== ROOT_GROUP;
  });
}

function boxOf(keyframe: ComputedKeyframe | undefined): GroupBox | null {
  const width = parseFloat(String(keyframe?.width ?? ''));
  const height = parseFloat(String(keyframe?.height ?? ''));
  if (!keyframe || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { transform: String(keyframe.transform ?? 'none'), width, height };
}

function haveMatchingShape(start: GroupBox, end: GroupBox): boolean {
  const startAspect = start.width / start.height;
  const endAspect = end.width / end.height;
  return Math.abs(startAspect / endAspect - 1) <= MAX_ASPECT_DRIFT;
}

function morphOnCompositor(animation: Animation): boolean {
  const effect = animation.effect as KeyframeEffect;
  const keyframes = effect.getKeyframes();
  if (keyframes.length < 2) return false;
  const [first] = keyframes;
  const start = boxOf(first);
  const end = boxOf(keyframes.at(-1));
  if (!start || !end?.width || !end.height || !haveMatchingShape(start, end)) return false;
  const scale = `scale(${start.width / end.width}, ${start.height / end.height})`;
  const startTransform = start.transform === 'none' ? scale : `${start.transform} ${scale}`;
  effect.setKeyframes([
    { transform: startTransform, transformOrigin: '0 0', easing: first.easing },
    { transform: end.transform, transformOrigin: '0 0' },
  ]);
  return true;
}

export function moveSharedElementsOnCompositor(transition: ViewTransition): void {
  transition.ready.then(
    () => {
      const root = document.documentElement;
      const morphed = groupAnimationsOf(root).map(morphOnCompositor);
      reportNavigationStep('compositor-morph', {
        groups: morphed.length,
        onCompositor: morphed.filter(Boolean).length,
      });
    },
    () => {},
  );
}
