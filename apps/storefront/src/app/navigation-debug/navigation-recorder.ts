import {
  observeNavigationSteps,
  reportNavigationStep,
  type NavigationDebugStep,
} from '@ratingo/ui/motion';

export interface NavigationLogEntry {
  at: number;
  step: string;
  path: string;
  scrollY: number;
  details?: Record<string, unknown>;
}

const MAX_ENTRIES = 250;
const LONG_FRAME_MS = 50;

type StartViewTransition = typeof document.startViewTransition;

function transitionTypesOf(argument: unknown): unknown {
  if (typeof argument === 'function' || argument === undefined) return 'callback';
  return (argument as { types?: unknown }).types ?? 'none';
}

function watchFramesWhile(transition: ViewTransition): void {
  let lastFrameAt = performance.now();
  let lastScrollY = window.scrollY;
  let isRunning = true;
  void transition.finished.finally(() => {
    isRunning = false;
  });
  const sample = () => {
    if (!isRunning) return;
    const now = performance.now();
    if (now - lastFrameAt > LONG_FRAME_MS) {
      reportNavigationStep('long-frame', { gapMs: Math.round(now - lastFrameAt) });
    }
    if (window.scrollY !== lastScrollY) {
      reportNavigationStep('scroll-during-transition', { from: lastScrollY, to: window.scrollY });
      lastScrollY = window.scrollY;
    }
    lastFrameAt = now;
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

function traceViewTransitions(): () => void {
  if (typeof document.startViewTransition !== 'function') {
    reportNavigationStep('view-transitions-unsupported');
    return () => {};
  }
  const original: StartViewTransition = document.startViewTransition;
  const traced = function (this: Document, ...args: Parameters<StartViewTransition>) {
    const types = transitionTypesOf(args[0]);
    const startedAt = performance.now();
    reportNavigationStep('vt-call', { types });
    let transition: ViewTransition;
    try {
      transition = original.apply(this, args);
    } catch (error) {
      reportNavigationStep('vt-call-threw', { types, error: String(error) });
      throw error;
    }
    const elapsed = () => Math.round(performance.now() - startedAt);
    transition.updateCallbackDone.then(
      () => reportNavigationStep('vt-updated', { types, ms: elapsed() }),
      (error: unknown) => reportNavigationStep('vt-update-failed', { types, error: String(error) }),
    );
    transition.ready.then(
      () => reportNavigationStep('vt-ready', { types, ms: elapsed() }),
      (error: unknown) => reportNavigationStep('vt-skipped', { types, error: String(error) }),
    );
    void transition.finished.then(() =>
      reportNavigationStep('vt-finished', { types, ms: elapsed() }),
    );
    watchFramesWhile(transition);
    return transition;
  } as StartViewTransition;
  document.startViewTransition = traced;
  return () => {
    if (document.startViewTransition === traced) document.startViewTransition = original;
  };
}

const AFTER_TRAVERSAL_WATCH_MS = 2000;

function traceInputAfterTraversal(): () => void {
  let watchUntil = 0;
  let poppedAt = 0;
  let lastLoggedScrollAt = 0;
  const since = () => Math.round(performance.now() - poppedAt);
  const isWatching = () => performance.now() < watchUntil;
  const onPopState = () => {
    poppedAt = performance.now();
    watchUntil = poppedAt + AFTER_TRAVERSAL_WATCH_MS;
    lastLoggedScrollAt = 0;
    const sampleFrames = (lastFrameAt: number) => {
      if (!isWatching()) return;
      const now = performance.now();
      if (now - lastFrameAt > LONG_FRAME_MS) {
        reportNavigationStep('long-frame-after-pop', {
          gapMs: Math.round(now - lastFrameAt),
          sinceMs: since(),
        });
      }
      requestAnimationFrame(() => sampleFrames(now));
    };
    requestAnimationFrame(() => sampleFrames(performance.now()));
  };
  const onTouch = (event: TouchEvent) => {
    if (isWatching())
      reportNavigationStep(event.type, { sinceMs: since(), cancelable: event.cancelable });
  };
  const onScroll = () => {
    if (!isWatching() || performance.now() - lastLoggedScrollAt < 150) return;
    lastLoggedScrollAt = performance.now();
    reportNavigationStep('scroll-after-pop', { sinceMs: since() });
  };
  window.addEventListener('popstate', onPopState, { capture: true });
  document.addEventListener('touchstart', onTouch, { capture: true, passive: true });
  document.addEventListener('touchend', onTouch, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouch, { capture: true, passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('popstate', onPopState, { capture: true });
    document.removeEventListener('touchstart', onTouch, { capture: true });
    document.removeEventListener('touchend', onTouch, { capture: true });
    document.removeEventListener('touchcancel', onTouch, { capture: true });
    window.removeEventListener('scroll', onScroll);
  };
}

const TOP_STRIP_WATCH_MS = 1500;
const TOP_STRIP_PROBE_Y = [24, 72];
const DEBUG_PANEL_SELECTOR = '[data-navigation-debug]';

function describeElement(element: Element): string {
  const data = Object.keys((element as HTMLElement).dataset ?? {})
    .slice(0, 2)
    .map((key) => `[${key}]`)
    .join('');
  const classes = [...element.classList]
    .filter((name) => /^(fixed|sticky|bg-|backdrop|opacity|hidden|md:hidden)/.test(name))
    .slice(0, 4)
    .join('.');
  return `${element.tagName.toLowerCase()}${data}${classes ? `.${classes}` : ''}`;
}

function firstPaintedBackground(elements: Element[]): string {
  for (const element of elements) {
    const style = getComputedStyle(element);
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none') {
      return `${describeElement(element)} bg=${style.backgroundColor} op=${style.opacity} blur=${style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter') || 'none'}`;
    }
  }
  return 'none';
}

function topStripSignature(): string {
  const root = document.documentElement;
  const probes = TOP_STRIP_PROBE_Y.map((y) => {
    const elements = document
      .elementsFromPoint(window.innerWidth / 2, y)
      .filter((element) => !element.closest(DEBUG_PANEL_SELECTOR));
    return `y${y}:${elements.slice(0, 3).map(describeElement).join('>')} | ${firstPaintedBackground(elements.slice(0, 4))}`;
  });
  return [
    `scroll=${Math.round(window.scrollY)}`,
    `vt=${root.getAttribute('data-nav-transition') ?? '-'}`,
    `skip=${root.hasAttribute('data-skip-view-transition') ? 'yes' : 'no'}`,
    `vis=${document.visibilityState}`,
    ...probes,
  ].join(' ; ');
}

function traceTopStrip(): () => void {
  let watchUntil = 0;
  let startedAt = 0;
  let frame = 0;
  let lastSignature = '';
  let isSampling = false;
  const sample = () => {
    const now = performance.now();
    if (now > watchUntil) {
      isSampling = false;
      reportNavigationStep('top-strip-end', { frames: frame });
      return;
    }
    frame += 1;
    const signature = topStripSignature();
    if (signature !== lastSignature) {
      reportNavigationStep('top-strip', {
        frame,
        sinceMs: Math.round(now - startedAt),
        state: signature,
      });
      lastSignature = signature;
    }
    requestAnimationFrame(sample);
  };
  const watch = (reason: string) => {
    startedAt = performance.now();
    watchUntil = startedAt + TOP_STRIP_WATCH_MS;
    frame = 0;
    lastSignature = '';
    reportNavigationStep('top-strip-start', { reason });
    if (!isSampling) {
      isSampling = true;
      requestAnimationFrame(sample);
    }
  };
  const onPopState = () => watch('popstate');
  const onPageShow = (event: PageTransitionEvent) =>
    watch(event.persisted ? 'pageshow-bfcache' : 'pageshow');
  const onPointerDown = (event: PointerEvent) => {
    if ((event.target as Element | null)?.closest?.('a[href]')) watch('link-tap');
  };
  window.addEventListener('popstate', onPopState, { capture: true });
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  return () => {
    window.removeEventListener('popstate', onPopState, { capture: true });
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  };
}

function traceTaps(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (link) reportNavigationStep('tap', { href: link.getAttribute('href') });
  };
  const onPageShow = (event: PageTransitionEvent) =>
    reportNavigationStep('pageshow', { persisted: event.persisted });
  const onVisibility = () =>
    reportNavigationStep('visibility', { state: document.visibilityState });
  document.addEventListener('pointerdown', onPointerDown, { capture: true });
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    window.removeEventListener('pageshow', onPageShow);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function recordNavigation(onEntries: (entries: NavigationLogEntry[]) => void): () => void {
  let entries: NavigationLogEntry[] = [];
  const onStep = ({ step, details }: NavigationDebugStep) => {
    const entry: NavigationLogEntry = {
      at: Math.round(performance.now()),
      step,
      path: window.location.pathname,
      scrollY: Math.round(window.scrollY),
      details,
    };
    entries = [...entries, entry].slice(-MAX_ENTRIES);
    onEntries(entries);
  };
  const stopObservingSteps = observeNavigationSteps(onStep);
  const stopTracingTransitions = traceViewTransitions();
  const stopTracingTaps = traceTaps();
  const stopTracingInput = traceInputAfterTraversal();
  const stopTracingTopStrip = traceTopStrip();
  return () => {
    stopTracingTopStrip();
    stopTracingInput();
    stopObservingSteps();
    stopTracingTransitions();
    stopTracingTaps();
  };
}

export function formatNavigationLog(entries: NavigationLogEntry[]): string {
  return entries
    .map((entry, index) => {
      const gap = index === 0 ? 0 : entry.at - entries[index - 1].at;
      const details = entry.details ? ` ${JSON.stringify(entry.details)}` : '';
      return `+${gap}ms ${entry.step} ${entry.path} y=${entry.scrollY}${details}`;
    })
    .join('\n');
}
