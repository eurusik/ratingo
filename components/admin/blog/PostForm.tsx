'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sanitizeHtml } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from './RichTextEditor';

const postSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug обов'язковий")
    .regex(/^[a-z0-9-]+$/, 'Тільки маленькі літери, цифри та дефіс'),
  title: z.string().min(1, "Заголовок обов'язковий"),
  brief: z.string().optional(),
  content: z.string().min(1, "Контент обов'язковий"),
  coverImage: z.string().url('Невірний URL').optional().or(z.literal('')),
  tags: z.string().optional(),
  published: z.boolean(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface PostFormProps {
  initialData?: {
    id: number;
    slug: string;
    title: string;
    brief: string | null;
    content: string;
    coverImage: string | null;
    tags: string[] | null;
    published: boolean;
  };
  mode: 'create' | 'edit';
}

export function PostForm({ initialData, mode }: PostFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      slug: initialData?.slug || '',
      title: initialData?.title || '',
      brief: initialData?.brief || '',
      content: initialData?.content || '',
      coverImage: initialData?.coverImage || '',
      tags: initialData?.tags?.join(', ') || '',
      published: initialData?.published || false,
    },
  });

  async function onSubmit(data: PostFormValues) {
    setIsSubmitting(true);
    try {
      const cleanedContent = sanitizeHtml(data.content);
      const tags = data.tags
        ? data.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const payload = {
        ...data,
        content: cleanedContent,
        tags,
        brief: data.brief || null,
        coverImage: data.coverImage || null,
      };

      const url = '/api/admin/blog';
      const method = mode === 'create' ? 'POST' : 'PUT';
      const body = mode === 'edit' ? { ...payload, id: initialData?.id } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save post');
      }

      router.push('/admin/blog');
      router.refresh();
    } catch (error) {
      console.error('Error saving post:', error);
      alert(error instanceof Error ? error.message : 'Failed to save post');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Заголовок</FormLabel>
              <FormControl>
                <Input placeholder="Новини про оновлення..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug (URL)</FormLabel>
              <FormControl>
                <Input placeholder="news-update-2024" {...field} />
              </FormControl>
              <FormDescription>Тільки маленькі літери, цифри та дефіс</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="brief"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Короткий опис</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Короткий опис для списку постів..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Контент</FormLabel>
              <FormControl>
                <RichTextEditor content={field.value} onChange={field.onChange} />
              </FormControl>
              <FormDescription>
                Використовуйте панель інструментів для форматування тексту
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Обкладинка (URL)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/image.jpg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Теги</FormLabel>
              <FormControl>
                <Input placeholder="оновлення, фічі, новини" {...field} />
              </FormControl>
              <FormDescription>Розділяйте теги комами</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="published"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Статус публікації</FormLabel>
                <FormDescription>Опублікувати пост для відвідувачів?</FormDescription>
              </div>
              <FormControl>
                <div className="flex items-center space-x-2">
                  {field.value ? (
                    <Badge variant="default" className="bg-green-600">
                      Опубліковано
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Чернетка</Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.onChange(!field.value)}
                  >
                    {field.value ? 'Зняти з публікації' : 'Опублікувати'}
                  </Button>
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Збереження...'
              : mode === 'create'
                ? 'Створити пост'
                : 'Зберегти зміни'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/blog')}>
            Скасувати
          </Button>
        </div>
      </form>
    </Form>
  );
}
