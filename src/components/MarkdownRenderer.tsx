import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRendererComponent: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const parseContent = (text: string) => {
    // Split text into paragraphs based on double newlines or just single lines to process lists correctly
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    const flushList = (keyPrefix: number) => {
         if (listBuffer.length > 0) {
             elements.push(
                 <ul key={`list-${keyPrefix}`} className="list-disc pl-5 mb-3 space-y-1 text-inherit">
                     {listBuffer}
                 </ul>
             );
             listBuffer = [];
         }
    };

    const processInline = (str: string) => {
        // Simple regex-based parser for inline styles
        let html = str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-inherit">$1</strong>')
            // Italic: *text*
            .replace(/\*([^*]+)\*/g, '<em class="italic text-inherit">$1</em>')
            // Code: `text` - Using semi-transparent bg for adaptability
            .replace(/`([^`]+)`/g, '<code class="bg-gray-500/10 px-1 py-0.5 rounded text-xs font-mono font-semibold text-inherit border border-gray-500/20">$1</code>');
        
        return { __html: html };
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        
        if (!trimmed) {
            flushList(idx);
            return;
        }

        // List Items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
            const content = trimmed.replace(/^[\-\*\•]\s+/, '');
            listBuffer.push(
                <li key={`li-${idx}`} className="text-inherit" dangerouslySetInnerHTML={processInline(content)} />
            );
        } 
        // Headers
        else if (trimmed.startsWith('### ')) {
            flushList(idx);
            elements.push(
                <h3 key={idx} className="text-sm font-bold mt-4 mb-2 text-inherit" dangerouslySetInnerHTML={processInline(trimmed.substring(4))} />
            );
        }
        else if (trimmed.startsWith('## ')) {
            flushList(idx);
            elements.push(
                <h2 key={idx} className="text-base font-bold mt-5 mb-2 text-inherit" dangerouslySetInnerHTML={processInline(trimmed.substring(3))} />
            );
        }
        // Standard Paragraphs
        else {
            flushList(idx);
            elements.push(
                <p key={idx} className="mb-3 leading-relaxed last:mb-0 text-inherit" dangerouslySetInnerHTML={processInline(trimmed)} />
            );
        }
    });

    flushList(lines.length);

    return <div className={`markdown-content text-sm ${className}`}>{elements}</div>;
  };

  return parseContent(content);
};

export const MarkdownRenderer = React.memo(MarkdownRendererComponent);