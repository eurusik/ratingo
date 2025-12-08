import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackToBlogLinkProps {
  className?: string;
}

export function BackToBlogLink({ className = '' }: BackToBlogLinkProps) {
  return (
    <Link
      href="/blog"
      className={`inline-flex items-center text-gray-400 hover:text-white transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Назад до блогу
    </Link>
  );
}
