'use client';

/**
 * Markdown editor with live preview, formatting toolbar, and WYSIWYG mode.
 */

import { useState, useRef } from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Link,
  Code,
  Quote,
  List,
  ListOrdered,
  ImageIcon,
} from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import { cn } from '@/shared/utils';

import { useImageUpload } from '../../hooks';
import { markdownToHtml, htmlToMarkdown } from '../../utils';
import { WysiwygEditor } from './wysiwyg-editor';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

type EditorMode = 'markdown' | 'wysiwyg';

interface ToolbarAction {
  icon: typeof Bold;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', prefix: '_', suffix: '_' },
  { icon: Heading2, label: 'Heading', prefix: '## ', suffix: '', block: true },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
  { icon: Code, label: 'Code', prefix: '`', suffix: '`' },
  { icon: Quote, label: 'Quote', prefix: '> ', suffix: '', block: true },
  { icon: List, label: 'List', prefix: '- ', suffix: '', block: true },
  { icon: ListOrdered, label: 'Numbered List', prefix: '1. ', suffix: '', block: true },
];

/**
 * Simple markdown to HTML converter for preview.
 */
function markdownToHtmlPreview(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Code
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-sm">$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />')
    // Blockquotes
    .replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-4 border-muted pl-4 italic text-muted-foreground my-4">$1</blockquote>',
    )
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="my-4">')
    .replace(/\n/g, '<br />');
}

/**
 * Markdown editor with write/preview tabs, formatting toolbar, and WYSIWYG mode.
 */
export function MarkdownEditor({ value, onChange, placeholder, className }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const [editorMode, setEditorMode] = useState<EditorMode>('markdown');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [htmlContent, setHtmlContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, state } = useImageUpload();
  const isUploading = state.isUploading;

  const handleModeChange = (newMode: EditorMode) => {
    if (newMode === editorMode) return;

    if (newMode === 'wysiwyg') {
      // Convert markdown to HTML for WYSIWYG editor
      const html = markdownToHtml(value);
      setHtmlContent(html);
    } else {
      // Convert HTML back to markdown
      const markdown = htmlToMarkdown(htmlContent);
      onChange(markdown);
    }
    setEditorMode(newMode);
  };

  const handleWysiwygChange = (html: string) => {
    setHtmlContent(html);
    // Also update markdown value for form state
    const markdown = htmlToMarkdown(html);
    onChange(markdown);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + text + value.slice(end);
    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const handleImageUpload = async (file: File) => {
    try {
      const url = await upload(file);
      insertAtCursor(`![image](${url})`);
    } catch {
      // Error handled by hook
    }
  };

  const applyFormat = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    let newText: string;
    let cursorOffset: number;

    if (action.block) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const beforeLine = value.slice(0, lineStart);
      const afterSelection = value.slice(end);
      newText = beforeLine + action.prefix + selectedText + action.suffix + afterSelection;
      cursorOffset = lineStart + action.prefix.length + selectedText.length;
    } else {
      newText = value.slice(0, start) + action.prefix + selectedText + action.suffix + value.slice(end);
      cursorOffset = start + action.prefix.length + selectedText.length + action.suffix.length;
    }

    onChange(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(cursorOffset, cursorOffset);
      } else {
        const pos = start + action.prefix.length;
        textarea.setSelectionRange(pos, pos);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageUpload(file);
        }
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      e.preventDefault();
      handleImageUpload(file);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
      />

      {/* Editor Mode Toggle */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={editorMode === 'markdown' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('markdown')}
        >
          {t('admin.journal.editor.markdown')}
        </Button>
        <Button
          type="button"
          variant={editorMode === 'wysiwyg' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('wysiwyg')}
        >
          {t('admin.journal.editor.wysiwyg')}
        </Button>
      </div>

      {editorMode === 'markdown' ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'write' | 'preview')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {TOOLBAR_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => applyFormat(action)}
                  disabled={activeTab === 'preview'}
                  title={action.label}
                >
                  <action.icon className="w-4 h-4" />
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={activeTab === 'preview' || isUploading}
                title="Image"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>

            <TabsList>
              <TabsTrigger value="write">{t('admin.journal.editor.write')}</TabsTrigger>
              <TabsTrigger value="preview">{t('admin.journal.editor.preview')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="write" className="mt-2">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder={placeholder}
              className="min-h-[400px] font-mono resize-y"
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-2">
            <div
              className={cn(
                'w-full min-h-[400px] p-4 rounded-md border bg-background',
                'prose prose-invert prose-sm max-w-none',
              )}
              dangerouslySetInnerHTML={{
                __html: value
                  ? `<p class="my-4">${markdownToHtmlPreview(value)}</p>`
                  : '<p class="text-muted-foreground">Nothing to preview</p>',
              }}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <WysiwygEditor
          value={htmlContent}
          onChange={handleWysiwygChange}
          placeholder={placeholder}
        />
      )}

      {isUploading && (
        <p className="text-sm text-muted-foreground">{t('admin.journal.uploadingImage')}</p>
      )}
    </div>
  );
}
