import { Button, Sheet } from '../../design/index.ts';
import { useDisplay } from '../../state/AppStateProvider.tsx';

export interface ConfirmationAction {
  title: string;
  onConfirm: () => void;
  destructive?: boolean;
}

interface ConfirmationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  actions: readonly ConfirmationAction[];
}

/** The web's `confirmationDialog`: a short question, its choices, and Cancel. Choosing closes it first. */
export function ConfirmationSheet({ isOpen, onClose, title, message, actions }: ConfirmationSheetProps) {
  const display = useDisplay();

  const choose = (action: ConfirmationAction) => {
    onClose();
    action.onConfirm();
  };

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 pb-2 pt-1">
        {message && <p className="type-subheadline text-center text-inkSoft">{message}</p>}
        {actions.map((action) => (
          <Button key={action.title} kind={action.destructive ? 'destructive' : 'secondary'} onClick={() => choose(action)}>
            {action.title}
          </Button>
        ))}
        <Button kind="tertiary" onClick={onClose}>
          {display.t('Cancel', 'გაუქმება')}
        </Button>
      </div>
    </Sheet>
  );
}
