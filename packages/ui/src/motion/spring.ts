const SPRING_STIFFNESS_PER_MS = 0.014;
const SETTLE_DISTANCE_PX = 0.5;
const SETTLE_VELOCITY_PX_PER_MS = 0.02;
const MAX_FRAME_MS = 32;

export function animateSpring(
  from: number,
  to: number,
  initialVelocity: number,
  update: (value: number) => void,
  onDone: () => void,
): () => void {
  const omega = SPRING_STIFFNESS_PER_MS;
  let position = from;
  let velocity = initialVelocity;
  let last = performance.now();
  let frame = 0;

  const step = (now: number) => {
    const dt = Math.min(now - last, MAX_FRAME_MS);
    last = now;
    const acceleration = -omega * omega * (position - to) - 2 * omega * velocity;
    velocity += acceleration * dt;
    position += velocity * dt;
    const settled =
      Math.abs(position - to) < SETTLE_DISTANCE_PX &&
      Math.abs(velocity) < SETTLE_VELOCITY_PX_PER_MS;
    if (settled) {
      update(to);
      onDone();
      return;
    }
    update(position);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}
