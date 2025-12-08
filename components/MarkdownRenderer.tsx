import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const parseContent = (text: string) => {
    // Split text into paragraphs based on double newlines or just single lines to process lists correctly
    // We'll process line by line to handle lists, but group paragraphs
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    const flushList = (keyPrefix: number) => {
         if (listBuffer.length > 0) {
             elements.push(
                 <ul key={`list-${keyPrefix}`} className="list-disc pl-5 mb-3 space-y-1 text-gray-700">
                     {listBuffer}
                 </ul>
             );
             listBuffer = [];
         }
    };

    const processInline = (str: string) => {
        // Simple regex-based parser for inline styles
        // Note: Using dangerouslySetInnerHTML requires sanitized input in production, 
        // but for this AI output context, we do a basic replacement.
        
        let html = str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            // Bold: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
            // Italic: *text*
            .replace(/\*([^*]+)\*/g, '<em class="italic text-gray-800">$1</em>')
            // Code: `text`
            .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-brand-red">$1</code>');
        
        return { __html: html };
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        
        // Skip empty lines, but use them to flush lists/paragraphs if needed
        if (!trimmed) {
            flushList(idx);
            return;
        }

        // List Items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
            const content = trimmed.replace(/^[\-\*\•]\s+/, '');
            listBuffer.push(
                <li key={`li-${idx}`} dangerouslySetInnerHTML={processInline(content)} />
            );
        } 
        // Headers
        else if (trimmed.startsWith('### ')) {
            flushList(idx);
            elements.push(
                <h3 key={idx} className="text-sm font-bold text-gray-900 mt-4 mb-2" dangerouslySetInnerHTML={processInline(trimmed.substring(4))} />
            );
        }
        else if (trimmed.startsWith('## ')) {
            flushList(idx);
            elements.push(
                <h2 key={idx} className="text-base font-bold text-brand-dark mt-5 mb-2" dangerouslySetInnerHTML={processInline(trimmed.substring(3))} />
            );
        }
        // Standard Paragraphs
        else {
            flushList(idx);
            elements.push(
                <p key={idx} className="mb-3 leading-relaxed text-gray-700 last:mb-0" dangerouslySetInnerHTML={processInline(trimmed)} />
            );
        }
    });

    flushList(lines.length);

    return <div className={`markdown-content text-sm ${className}`}>{elements}</div>;
  };

  return parseContent(content);
};
