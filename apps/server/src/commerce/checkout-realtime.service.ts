import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { MarketCode } from '@lumea/types';

/** Publishes cache invalidations only; storefront clients refetch public checkout data. */
@Injectable()
export class CheckoutRealtimeService {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace) {
    this.namespace = namespace;
  }

  settingsChanged(marketCode: MarketCode | string) {
    this.namespace?.to(`checkout:${marketCode}`).emit('checkout:changed');
  }
}
