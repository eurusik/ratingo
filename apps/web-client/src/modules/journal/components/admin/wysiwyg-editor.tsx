'use client';

/**
 * TipTap WYSIWYG editor component.
 */

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading2,
  Link as LinkIcon,
  Code,
  Quote,
  List,
  ListOrdered,
  ImageIcon,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils';

import { useImageUpload } from '../../hooks';

export interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

interface ToolbarButtonProps {
  icon: typeof Bold;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, isActive, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0', isActive && 'bg-accent')}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}

/**
 * WYSIWYG editor using TipTap.
 */
export function WysiwygEditor({ value, onChange, placeholder, className }: WysiwygEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, state } = useImageUpload();
  const isUploading = state.isUploading;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full rounded-lg my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[400px] w-full p-4 outline-none',
          'prose prose-invert prose-sm max-w-none',
          '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4',
          '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-3',
          '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
          '[&_code]:px-1 [&_code]:py-0.5 [&_code]:bg-muted [&_code]:rounded [&_code]:text-sm',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
          '[&_ul]:list-disc [&_ul]:ml-4',
          '[&_ol]:list-decimal [&_ol]:ml-4',
          '[&_p]:my-4',
        ),
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const handleImageUpload = async (file: File) => {
    if (!editor) return;
    try {
      const url = await upload(file);
      editor.chain().focus().setImage({ src: url, alt: 'image' }).run();
    } catch {
      // Error handled by hook
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const addLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
      />

      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Heading2}
          label="Heading"
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon={LinkIcon}
          label="Link"
          isActive={editor.isActive('link')}
          onClick={addLink}
        />
        <ToolbarButton
          icon={Code}
          label="Code"
          isActive={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          icon={Quote}
          label="Quote"
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={List}
          label="Bullet List"
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Ordered List"
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={ImageIcon}
          label="Image"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        />
      </div>

      <div className="rounded-md border bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
