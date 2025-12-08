export function BlogPostSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-zinc-800 rounded-lg w-3/4" />
          <div className="h-6 bg-zinc-800 rounded-lg w-1/3" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 bg-zinc-800 rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
