'use client';

import { ConfirmTypedDialog } from '@/components/confirm-typed-dialog';
import { marketLabel, useAdminMarket } from '@/lib/market-context';
import { MarketCode, type CatalogCopyResult } from '@lumea/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@lumea/ui';
import { useEffect, useMemo, useState } from 'react';

export type CopyToMarketDialogProps = {
  open: boolean;
  /** Short name shown in descriptions (product/brand/coupon code). */
  entityName: string;
  entityKind: 'product' | 'category' | 'brand' | 'coupon';
  sourceMarket: MarketCode;
  onCancel: () => void;
  onCopy: (targetMarket: MarketCode) => Promise<CatalogCopyResult>;
  /** Called after a successful copy (result included for warnings). */
  onCopied?: (result: CatalogCopyResult) => void;
};

/**
 * Two-step flow: pick target market → typed confirm with market label.
 */
export function CopyToMarketDialog({
  open,
  entityName,
  entityKind,
  sourceMarket,
  onCancel,
  onCopy,
  onCopied,
}: CopyToMarketDialogProps) {
  const { markets } = useAdminMarket();
  const targets = useMemo(
    () => markets.filter((m) => m.code !== sourceMarket && m.enabled),
    [markets, sourceMarket],
  );

  const [step, setStep] = useState<'pick' | 'confirm' | 'done'>('pick');
  const [target, setTarget] = useState<MarketCode | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CatalogCopyResult | null>(null);

  useEffect(() => {
    if (open) {
      setStep('pick');
      setTarget('');
      setError(null);
      setResult(null);
    }
  }, [open]);

  const targetLabel = target ? marketLabel(target) : '';

  function close() {
    onCancel();
  }

  async function handleConfirm() {
    if (!target) return;
    setError(null);
    try {
      const copied = await onCopy(target);
      onCopied?.(copied);
      if (copied.warnings?.length) {
        setResult(copied);
        setStep('done');
      } else {
        close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed');
      setStep('pick');
    }
  }

  if (open && step === 'done' && result) {
    return (
      <Dialog open onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copied with notes</DialogTitle>
            <DialogDescription>
              “{entityName}” was copied to {marketLabel(result.targetMarket)}.
              Review the notes below.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button type="button" onClick={close}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        open={open && step === 'pick'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy {entityKind} to market</DialogTitle>
            <DialogDescription>
              Clone “{entityName}” from {marketLabel(sourceMarket)} into another
              market window. The original stays unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Target market</Label>
              {targets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other enabled markets available.
                </p>
              ) : (
                <Select
                  value={target || undefined}
                  onValueChange={(v) => setTarget(v as MarketCode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select market…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {marketLabel(m.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!target}
                onClick={() => setStep('confirm')}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmTypedDialog
        open={open && step === 'confirm' && !!target}
        title={`Copy to ${targetLabel}`}
        description={`This creates a new ${entityKind} in ${targetLabel} based on “${entityName}”. Type the market label to confirm.`}
        confirmLabel={targetLabel}
        confirmValue={targetLabel}
        confirmButtonLabel="Copy"
        destructive={false}
        onCancel={() => setStep('pick')}
        onConfirm={handleConfirm}
      />
    </>
  );
}
