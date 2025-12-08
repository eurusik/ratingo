import styles from './BlogPostContent.module.css';

interface BlogPostContentProps {
  content: string;
}

export function BlogPostContent({ content }: BlogPostContentProps) {
  return (
    <div className="prose prose-invert prose-lg max-w-none">
      <div
        className={`${styles.content} text-gray-300 leading-relaxed`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
