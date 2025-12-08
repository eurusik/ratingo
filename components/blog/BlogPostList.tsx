import Link from 'next/link';
import { Calendar, ArrowRight, Tag } from 'lucide-react';

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  brief: string | null;
  coverImage: string | null;
  tags: string[] | null;
  publishedAt: string | null;
}

interface BlogPostListProps {
  posts: BlogPost[];
}

export function BlogPostList({ posts }: BlogPostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-gray-500">Поки що немає публікацій</p>
        <p className="text-sm text-gray-600 mt-2">
          Але скоро тут з'являться новини про розвиток проєкту!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <Link key={post.id} href={`/blog/${post.slug}`} className="block group">
          <article className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
            {post.coverImage && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}

            <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">
              {post.title}
            </h2>

            {post.brief && <p className="text-gray-400 mb-4 line-clamp-2">{post.brief}</p>}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                {post.publishedAt && (
                  <div className="flex items-center text-gray-500">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString('uk-UA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                )}

                {post.tags && post.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    {post.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-zinc-800/50 text-gray-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center text-blue-400 group-hover:text-blue-300 transition-colors">
                <span className="mr-1">Читати</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
