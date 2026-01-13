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
}

export function ChatInput({ onSend, disabled, placeholder = 'Type your response...', interimTranscript = '', value, onChange }: ChatInputProps) {
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
      <Textarea
        value={displayValue}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`min-h-[80px] max-h-[200px] resize-none flex-1 ${interimTranscript ? 'italic text-muted-foreground' : ''}`}
        rows={3}
      />
      <Button 
        type="submit" 
        disabled={disabled || !message.trim()} 
        size="icon" 
        className="h-[80px] w-12 shrink-0"
      >
        <Send className="h-4 w-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  );
}
