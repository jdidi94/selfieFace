import { BadRequestException, Injectable } from '@nestjs/common';
import type { StoreSettings } from '@prisma/client';
import { StoreSettingsService } from './store-settings.service';

type InitPaymentInput = {
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  description?: string;
  successUrl: string;
  failUrl: string;
  webhookUrl: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
};

type InitPaymentResult = {
  payUrl: string;
  paymentRef: string;
};

@Injectable()
export class KonnectService {
  constructor(private readonly settingsService: StoreSettingsService) {}

  private baseUrl(settings: StoreSettings): string {
    return settings.konnectSandbox
      ? 'https://api.preprod.konnect.network/api/v2'
      : 'https://api.konnect.network/api/v2';
  }

  async initPayment(
    settings: StoreSettings,
    input: InitPaymentInput,
  ): Promise<InitPaymentResult> {
    const apiKey = this.settingsService.resolveKonnectApiKey(settings);
    const walletId = this.settingsService.resolveKonnectWalletId(settings);
    if (!apiKey || !walletId) {
      throw new BadRequestException('Konnect is not configured');
    }

    const token = input.currency.toUpperCase();
    const res = await fetch(`${this.baseUrl(settings)}/payments/init-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        receiverWalletId: walletId,
        token,
        amount: input.amount,
        type: 'immediate',
        description: input.description ?? `Order ${input.orderNumber}`,
        acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
        lifespan: 60,
        checkoutForm: false,
        addPaymentFeesToAmount: false,
        orderId: input.orderId,
        webhook: input.webhookUrl,
        silentWebhook: true,
        successUrl: input.successUrl,
        failUrl: input.failUrl,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        phoneNumber: input.phoneNumber ?? undefined,
        email: input.email ?? undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(
        `Konnect init failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
      );
    }

    const data = (await res.json()) as { payUrl?: string; paymentRef?: string };
    if (!data.payUrl || !data.paymentRef) {
      throw new BadRequestException('Konnect did not return a payment URL');
    }
    return { payUrl: data.payUrl, paymentRef: data.paymentRef };
  }

  async isPaymentCompleted(settings: StoreSettings, paymentRef: string): Promise<boolean> {
    const apiKey = this.settingsService.resolveKonnectApiKey(settings);
    if (!apiKey) throw new BadRequestException('Konnect is not configured');

    const res = await fetch(`${this.baseUrl(settings)}/payments/${paymentRef}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!res.ok) {
      throw new BadRequestException(`Konnect status check failed (${res.status})`);
    }
    const data = (await res.json()) as {
      payment?: { status?: string; amount?: number; orderId?: string };
    };
    return data.payment?.status === 'completed';
  }
}
