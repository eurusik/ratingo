'use client';

/**
 * Client component for journal post detail page.
 * Maps DTO to domain type and renders PostDetail.
 */

import { PostDetail, type PostDetailDto, type JournalPost, type PostType } from '@/modules/journal';

interface JournalPostPageClientProps {
  post: PostDetailDto;
}

/**
 * Maps API DTO to domain type.
 */
function mapPostDetail(dto: PostDetailDto): JournalPost {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt,
    body: dto.body,
    bodyHtml: dto.bodyHtml,
    type: dto.type as PostType,
    featuredImageUrl: dto.featuredImageUrl ?? null,
    contextId: dto.contextId ?? null,
    metaTitle: dto.metaTitle ?? null,
    metaDescription: dto.metaDescription ?? null,
    publishedAt: new Date(dto.publishedAt),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    navigation: {
      prev: dto.navigation.prev
        ? { slug: dto.navigation.prev.slug, title: dto.navigation.prev.title }
        : null,
      next: dto.navigation.next
        ? { slug: dto.navigation.next.slug, title: dto.navigation.next.title }
        : null,
    },
  };
}

/**
 * Client wrapper for PostDetail component.
 */
export function JournalPostPageClient({ post }: JournalPostPageClientProps) {
  const mappedPost = mapPostDetail(post);

  return <PostDetail post={mappedPost} />;
}
