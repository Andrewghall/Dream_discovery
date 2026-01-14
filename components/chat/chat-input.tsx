'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  interimTranscript?: string;
  value?: string;
  onChange?: (value: string) => void;
  showSendButton?: boolean;
  singleLine?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = 'Type your response...',
  interimTranscript = '',
  value,
  onChange,
  showSendButton = true,
  singleLine = false,
}: ChatInputProps) {
  const [internalMessage, setInternalMessage] = useState('');
  const message = value ?? internalMessage;
  const setMessage = onChange ?? setInternalMessage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const displayValue = interimTranscript || message;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      {singleLine ? (
        <input
          value={displayValue}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          enterKeyHint="send"
          placeholder={placeholder}
          disabled={disabled}
          className={`h-11 sm:h-12 w-full flex-1 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${interimTranscript ? 'italic text-muted-foreground' : ''}`}
        />
      ) : (
        <Textarea
          value={displayValue}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`min-h-[52px] sm:min-h-[80px] max-h-[200px] resize-none flex-1 ${interimTranscript ? 'italic text-muted-foreground' : ''}`}
          rows={2}
        />
      )}
      {showSendButton && (
        <Button 
          type="submit" 
          disabled={disabled || !message.trim()} 
          size="icon" 
          className="h-12 w-12 shrink-0 sm:h-[80px]"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      )}
    </form>
  );
}
