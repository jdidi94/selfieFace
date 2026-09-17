'use client';

import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import { OrderStatus, type OrderTimelineEventDto } from '@lumea/types';
import { useMemo } from 'react';

const FLOW: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function statusLabel(
  status: OrderStatus | string,
  t: ReturnType<typeof getMessages>,
): string {
  switch (status) {
    case OrderStatus.PENDING:
      return t.orderStatusPending;
    case OrderStatus.PROCESSING:
      return t.orderStatusProcessing;
    case OrderStatus.SHIPPED:
      return t.orderStatusShipped;
    case OrderStatus.DELIVERED:
      return t.orderStatusDelivered;
    case OrderStatus.CANCELLED:
      return t.orderStatusCancelled;
    default:
      return status;
  }
}

function rank(status: OrderStatus | string): number {
  const i = FLOW.indexOf(status as OrderStatus);
  return i >= 0 ? i : -1;
}

export function OrderStatusTimeline({
  status,
  timeline,
  createdAt,
}: {
  status: OrderStatus | string;
  timeline?: OrderTimelineEventDto[];
  createdAt: string;
}) {
  const { locale } = useLocale();
  const t = getMessages(locale);
  const cancelled = status === OrderStatus.CANCELLED;

  const eventByStatus = useMemo(() => {
    const map = new Map<string, OrderTimelineEventDto>();
    for (const ev of timeline ?? []) {
      if (!map.has(ev.status)) map.set(ev.status, ev);
    }
    return map;
  }, [timeline]);

  const currentRank = cancelled ? -1 : rank(status);

  const steps = cancelled
    ? [
        {
          key: OrderStatus.PENDING,
          label: statusLabel(OrderStatus.PENDING, t),
          done: true,
          current: false,
          at: eventByStatus.get(OrderStatus.PENDING)?.createdAt ?? createdAt,
          note: eventByStatus.get(OrderStatus.PENDING)?.note,
        },
        {
          key: OrderStatus.CANCELLED,
          label: statusLabel(OrderStatus.CANCELLED, t),
          done: true,
          current: true,
          at: eventByStatus.get(OrderStatus.CANCELLED)?.createdAt,
          note: eventByStatus.get(OrderStatus.CANCELLED)?.note,
        },
      ]
    : FLOW.map((s, i) => {
        const ev = eventByStatus.get(s);
        const done = i <= currentRank;
        const current = i === currentRank;
        return {
          key: s,
          label: statusLabel(s, t),
          done,
          current,
          at: ev?.createdAt ?? (i === 0 ? createdAt : undefined),
          note: ev?.note,
        };
      });

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={`absolute start-[7px] top-4 h-[calc(100%-0.5rem)] w-px ${
                  step.done ? 'bg-primary' : 'bg-border'
                }`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                step.current
                  ? 'border-primary bg-primary'
                  : step.done
                    ? 'border-primary bg-primary'
                    : 'border-border bg-surface'
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  step.done || step.current ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
                {step.current ? (
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    ({t.orderStatusCurrent})
                  </span>
                ) : null}
              </p>
              {step.at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(step.at).toLocaleString(locale)}
                </p>
              )}
              {step.note && <p className="mt-0.5 text-sm text-muted-foreground">{step.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
