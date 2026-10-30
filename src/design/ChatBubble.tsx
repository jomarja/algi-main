import type { ReactNode } from 'react';
import { useDisplay } from '../state/AppStateProvider.tsx';
import { cx } from './cx.ts';
import { MascotAvatar } from './mascot/MascotView.tsx';

interface ChatBubbleProps {
  role: 'user' | 'coach';
  text: string;
  /** Extra coach content under the text, such as explanations and actions. */
  children?: ReactNode;
}

/** A chat message. The user's are dark and on the right; Luka's are white with his avatar. */
export function ChatBubble({ role, text, children }: ChatBubbleProps) {
  const display = useDisplay();
  const isUser = role === 'user';

  return (
    <div className={cx('flex items-end gap-2', isUser ? 'justify-end pl-12' : 'pr-6')}>
      {!isUser && <MascotAvatar size={32} decorative />}
      <div
        className={cx(
          'flex min-w-0 flex-col gap-3 rounded-[20px] px-4 py-3',
          isUser ? 'rounded-br-[6px] bg-ink text-white' : 'rounded-bl-[6px] border border-line bg-surface text-ink',
        )}
      >
        <p className="type-callout whitespace-pre-wrap break-words">
          <span className="sr-only">{isUser ? display.t('You:', 'შენ:') : display.t('Luka:', 'ლუკა:')} </span>
          {text}
        </p>
        {children}
      </div>
    </div>
  );
}

/** Animated "Luka is typing" indicator: three mint dots lighting up in turn. */
export function TypingIndicator() {
  const display = useDisplay();
  return (
    <div className="flex items-end gap-2" role="status" aria-label={display.t('Luka is typing…', 'ლუკა წერს…')}>
      <MascotAvatar size={32} decorative />
      <span className="flex items-center gap-[5px] rounded-full border border-line bg-surface px-4 py-[14px]">
        {[0, 320, 640].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="h-2 w-2 animate-typing-dot rounded-full bg-mint opacity-35"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
