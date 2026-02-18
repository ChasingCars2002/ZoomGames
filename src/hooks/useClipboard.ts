import { useCallback, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// useCopyToClipboard
// ---------------------------------------------------------------------------

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<void>;
  copied: boolean;
}

export function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      // Clear any existing timeout so rapid calls don't overlap
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset copied state after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      // Fallback for older browsers or insecure contexts
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        setCopied(true);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setCopied(false);
          timeoutRef.current = null;
        }, 2000);
      } catch {
        setCopied(false);
      }
    }
  }, []);

  return { copy, copied };
}

export default useCopyToClipboard;
