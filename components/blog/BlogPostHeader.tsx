import { BlogPostMeta } from './atoms/BlogPostMeta';

interface BlogPostHeaderProps {
  title: string;
  coverImage: string | null;
  publishedAt: string | null;
  tags: string[] | null;
}

export function BlogPostHeader({ title, coverImage, publishedAt, tags }: BlogPostHeaderProps) {
  return (
    <>
      {coverImage && (
        <div className="mb-8 rounded-xl overflow-hidden">
          <img src={coverImage} alt={title} className="w-full h-64 md:h-96 object-cover" />
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          {title}
        </h1>

        <BlogPostMeta publishedAt={publishedAt} tags={tags} />
      </header>
    </>
  );
}
