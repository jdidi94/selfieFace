'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@lumea/ui';
import { useEffect, useId, useState } from 'react';

export type ConfirmTypedDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Text shown as the string the user must type. */
  confirmLabel: string;
  /** Expected input value (case-sensitive; compared against trimmed input). */
  confirmValue: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Confirm button label. Defaults to "Confirm". */
  confirmButtonLabel?: string;
  /** When true (default), uses destructive button styling. */
  destructive?: boolean;
};

export function ConfirmTypedDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmValue,
  onConfirm,
  onCancel,
  confirmButtonLabel = 'Confirm',
  destructive = true,
}: ConfirmTypedDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTyped('');
      setBusy(false);
    }
  }, [open]);

  const matches = typed.trim() === confirmValue;
  const canConfirm = matches && !busy && confirmValue.length > 0;

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={inputId}>
              Type <span className="font-mono text-foreground">{confirmLabel}</span> to confirm
            </Label>
            <Input
              id={inputId}
              value={typed}
              autoComplete="off"
              autoFocus
              spellCheck={false}
              placeholder={confirmLabel}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'primary'}
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
            >
              {busy ? 'Working…' : confirmButtonLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Prefer a non-empty entity name; otherwise fall back to DELETE / DISABLE / BLOCK. */
export function typedConfirmToken(
  entityName: string | null | undefined,
  fallback: 'DELETE' | 'DISABLE' | 'BLOCK',
): string {
  const trimmed = entityName?.trim();
  return trimmed || fallback;
}
