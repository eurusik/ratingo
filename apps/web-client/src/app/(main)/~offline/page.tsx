export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold text-white">Ви офлайн</h1>
      <p className="max-w-md text-lg text-cinema-muted">
        Схоже, що немає з&apos;єднання з інтернетом. Перевірте підключення та спробуйте ще раз.
      </p>
    </div>
  );
}
