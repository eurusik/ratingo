import { Metadata } from 'next';
import ClientBlog from './ClientBlog';

export const metadata: Metadata = {
  title: 'Блог | Ratingo',
  description: 'Оновлення та новини про розвиток проєкту Ratingo',
};

export default function BlogPage() {
  return <ClientBlog />;
}
