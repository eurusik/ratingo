import { Metadata } from 'next';
import ClientBlogPost from './ClientBlogPost';

export const metadata: Metadata = {
  title: 'Пост | Блог Ratingo',
  description: 'Читайте про оновлення та новини проєкту Ratingo',
};

export default function BlogPostPage() {
  return <ClientBlogPost />;
}
