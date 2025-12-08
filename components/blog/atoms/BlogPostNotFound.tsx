import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BlogPostNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Пост не знайдено</h1>
          <p className="text-gray-400 mb-8">Такого поста не існує або він був видалений</p>
          <Link
            href="/blog"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Повернутись до блогу
          </Link>
        </div>
      </div>
    </div>
  );
}
