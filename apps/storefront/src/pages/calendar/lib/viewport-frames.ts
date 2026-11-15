type FrameJob = () => void;

const scheduled = new Set<FrameJob>();
const viewportListeners = new Set<FrameJob>();
let frame = 0;

function runScheduled(): void {
  frame = 0;
  const jobs = [...scheduled];
  scheduled.clear();
  jobs.forEach((job) => job());
}

export function scheduleFrame(job: FrameJob): void {
  scheduled.add(job);
  if (frame === 0) frame = requestAnimationFrame(runScheduled);
}

function scheduleViewportListeners(): void {
  viewportListeners.forEach(scheduleFrame);
}

export function onViewportChange(job: FrameJob): () => void {
  if (viewportListeners.size === 0) {
    window.addEventListener('scroll', scheduleViewportListeners, { passive: true });
    window.addEventListener('resize', scheduleViewportListeners, { passive: true });
  }
  viewportListeners.add(job);
  return () => {
    viewportListeners.delete(job);
    scheduled.delete(job);
    if (viewportListeners.size > 0) return;
    window.removeEventListener('scroll', scheduleViewportListeners);
    window.removeEventListener('resize', scheduleViewportListeners);
  };
}
