import { Button, Icon, Sheet } from '../../design/index.ts';
import { LESSON_CONTENT } from '../../engine/index.ts';
import type { Lesson } from '../../engine/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

interface LessonSheetProps {
  lesson: Lesson;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (lesson: Lesson) => void;
}

/** A two-minute lesson (RewardsSection.swift `LessonSheet`); "Got it" counts it toward Money basics. */
export function LessonSheet({ lesson, isOpen, onClose, onComplete }: LessonSheetProps) {
  const display = useDisplay();
  const content = LESSON_CONTENT[lesson];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={display.text(content.title)}
      footer={
        <Button
          onClick={() => {
            onComplete(lesson);
            onClose();
          }}
        >
          {display.t('Got it', 'გასაგებია')}
        </Button>
      }
    >
      <ul className="flex flex-col gap-4 py-2">
        {content.points.map((point) => (
          <li key={point.en} className="flex items-start gap-3">
            <span className="pt-0.5 text-amberDeep">
              <Icon name="sparkle" size={17} />
            </span>
            <span className="type-body text-ink">{display.text(point)}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
