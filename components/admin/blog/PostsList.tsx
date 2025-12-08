'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye } from 'lucide-react';

interface Post {
  id: number;
  slug: string;
  title: string;
  published: boolean;
  createdAt: string;
  publishedAt: string | null;
}

interface PostsListProps {
  posts: Post[];
}

export function PostsList({ posts }: PostsListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/blog?id=${deleteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete post');
      }

      router.refresh();
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 border border-zinc-800 rounded-lg">
        <p className="text-gray-400 mb-4">Постів ще немає</p>
        <Link href="/admin/blog/new">
          <Button>Створити перший пост</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-zinc-900/50">
              <TableHead className="w-[50px]">ID</TableHead>
              <TableHead>Заголовок</TableHead>
              <TableHead className="w-[120px]">Статус</TableHead>
              <TableHead className="w-[150px]">Дата створення</TableHead>
              <TableHead className="w-[200px] text-right">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id} className="hover:bg-zinc-900/30">
                <TableCell className="font-mono text-xs text-gray-500">{post.id}</TableCell>
                <TableCell className="font-medium">
                  <div>
                    <div className="text-white">{post.title}</div>
                    <div className="text-xs text-gray-500 font-mono">/{post.slug}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {post.published ? (
                    <Badge variant="default" className="bg-green-600">
                      Опубліковано
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Чернетка</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-400">
                  {new Date(post.createdAt).toLocaleDateString('uk-UA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/blog/${post.slug}`} target="_blank">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/admin/blog/edit/${post.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(post.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити пост?</AlertDialogTitle>
            <AlertDialogDescription>
              Ця дія незворотна. Пост буде видалено назавжди.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Видалення...' : 'Видалити'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
