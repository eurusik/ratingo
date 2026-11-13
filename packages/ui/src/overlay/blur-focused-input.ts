export function blurFocusedInputWithin(container: HTMLElement): void {
  const active = document.activeElement;
  if (
    (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
    container.contains(active)
  ) {
    active.blur();
  }
}
