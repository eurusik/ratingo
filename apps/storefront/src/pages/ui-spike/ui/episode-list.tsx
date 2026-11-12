const EPISODE_COUNT = 24;
const EPISODE_NUMBERS = Array.from({ length: EPISODE_COUNT }, (_, index) => index + 1);

export function EpisodeList() {
  return (
    <ol className="flex flex-col gap-3">
      {EPISODE_NUMBERS.map((episode) => (
        <li key={episode} className="rounded-xl bg-surface-tertiary p-3">
          Епізод {episode}
        </li>
      ))}
    </ol>
  );
}
