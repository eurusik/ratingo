import { PostForm } from '@/components/admin/blog/PostForm';
import { requireAuth } from '@/lib/auth';

export default async function NewPostPage() {
  await requireAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Новий пост
        </h1>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <PostForm mode="create" />
        </div>
      </div>
    </div>
  );
}
