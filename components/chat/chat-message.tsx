import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  role: 'AI' | 'PARTICIPANT';
  content: string;
  timestamp: Date;
  participantName?: string;
}

export function ChatMessage({ role, content, timestamp, participantName }: ChatMessageProps) {
  const isAI = role === 'AI';

  return (
    <div className={cn('flex gap-2 sm:gap-3 mb-4', isAI ? 'justify-start' : 'justify-end')}>
      {isAI && (
        <Avatar className="h-8 w-8 mt-1 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn('flex flex-col max-w-[85%] sm:max-w-[80%] md:max-w-[75%]', !isAI && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-sm break-words',
            isAI
              ? 'bg-muted text-foreground'
              : 'bg-primary text-primary-foreground'
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1 px-1">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {!isAI && (
        <Avatar className="h-8 w-8 mt-1 shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
