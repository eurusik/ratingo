import { Calendar, Tag } from 'lucide-react';

interface BlogPostMetaProps {
  publishedAt: string | null;
  tags: string[] | null;
}

export function BlogPostMeta({ publishedAt, tags }: BlogPostMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
      {publishedAt && (
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-1.5" />
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString('uk-UA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4" />
          {tags.map((tag: string) => (
            <span key={tag} className="px-2 py-1 bg-zinc-800/50 text-gray-400 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
