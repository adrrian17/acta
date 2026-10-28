import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@acta/ui/components/alert-dialog";

import { COPY } from "./copy";

interface ConflictDialogProps {
  open: boolean;
  pending: boolean;
  /** Closing without a choice keeps the local edit open. */
  onClose: () => void;
  onReload: () => void;
  onOverwrite: () => void;
}

export function ConflictDialog({
  open,
  pending,
  onClose,
  onReload,
  onOverwrite,
}: ConflictDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{COPY.conflictTitle}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onReload}>
            {COPY.conflictReload}
          </AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onOverwrite}>
            {COPY.conflictOverwrite}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
