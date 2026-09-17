import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import type { RequestUser } from '../auth/auth.types';
import { CartService } from './cart.service';
import { CheckoutService } from './checkout.service';
import { CouponsService } from './coupons.service';
import { OrdersService } from './orders.service';
import { StoreSettingsService } from './store-settings.service';

@Controller()
export class CommerceController {
  constructor(
    private readonly cartService: CartService,
    private readonly checkoutService: CheckoutService,
    private readonly couponsService: CouponsService,
    private readonly ordersService: OrdersService,
    private readonly settingsService: StoreSettingsService,
  ) {}

  @Get('cart')
  @UseGuards(OptionalJwtAuthGuard)
  getCart(
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-cart-id') cartId?: string,
    @Headers('x-guest-token') guestToken?: string,
    @Query('currency') currency?: string,
  ) {
    return this.cartService.getOrCreate({
      cartId,
      guestToken,
      userId: user?.sub,
      currency: currency as 'USD' | 'TND' | 'AED' | undefined,
    });
  }

  @Post('cart/items')
  @UseGuards(OptionalJwtAuthGuard)
  addItem(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-cart-id') cartId?: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.addItem({ cartId, guestToken, userId: user?.sub }, body);
  }

  @Patch('cart/:cartId/items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  updateItem(
    @Param('cartId') cartId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.updateItem(cartId, itemId, body, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Delete('cart/:cartId/items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  removeItem(
    @Param('cartId') cartId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.removeItem(cartId, itemId, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Patch('cart/:cartId/currency')
  @UseGuards(OptionalJwtAuthGuard)
  setCurrency(
    @Param('cartId') cartId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.setCurrency(cartId, body, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Post('cart/:cartId/coupon')
  @UseGuards(OptionalJwtAuthGuard)
  applyCoupon(
    @Param('cartId') cartId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.applyCoupon(cartId, body, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Delete('cart/:cartId/coupon')
  @UseGuards(OptionalJwtAuthGuard)
  removeCoupon(
    @Param('cartId') cartId: string,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.removeCoupon(cartId, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Post('cart/:cartId/loyalty')
  @UseGuards(OptionalJwtAuthGuard)
  applyLoyalty(
    @Param('cartId') cartId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.applyLoyalty(cartId, body, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Delete('cart/:cartId/loyalty')
  @UseGuards(OptionalJwtAuthGuard)
  removeLoyalty(
    @Param('cartId') cartId: string,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    return this.cartService.removeLoyalty(cartId, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Post('checkout/quote')
  @UseGuards(OptionalJwtAuthGuard)
  quote(
    @Body() body: { cartId?: string; country: string; currency?: string; shippingMethodId?: string },
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-cart-id') cartIdHeader?: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    const cartId = body.cartId ?? cartIdHeader ?? '';
    return this.checkoutService.quoteShipping(cartId, body, {
      userId: user?.sub,
      guestToken,
    });
  }

  @Get('checkout/payment-options')
  paymentOptions(@Query('currency') currency?: string) {
    return this.settingsService.getPaymentOptions(currency);
  }

  @Get('payments/konnect/webhook')
  konnectWebhook(@Query('payment_ref') paymentRef?: string) {
    return this.checkoutService.handleKonnectWebhook(paymentRef ?? '');
  }

  @Post('checkout')
  @UseGuards(OptionalJwtAuthGuard)
  checkout(
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-token') guestToken?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Only CUSTOMER JWTs get authenticated checkout; admins / missing auth → guest path
    const userId = user?.type === UserType.CUSTOMER ? user.sub : null;
    return this.checkoutService.createCheckout(body, {
      userId,
      guestToken,
      idempotencyKey,
    });
  }

  @Get('orders/:id/payment-secret')
  @UseGuards(OptionalJwtAuthGuard)
  paymentSecret(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-order-token') guestAccessToken?: string,
  ) {
    return this.checkoutService.getPaymentClientSecret(id, {
      userId: user?.type === UserType.CUSTOMER ? user.sub : null,
      guestAccessToken,
    });
  }

  @Post('orders/:id/confirm-payment')
  @UseGuards(OptionalJwtAuthGuard)
  confirm(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-order-token') guestAccessToken?: string,
  ) {
    return this.checkoutService.confirmPayment(id, body, {
      userId: user?.type === UserType.CUSTOMER ? user.sub : null,
      guestAccessToken,
    });
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.CUSTOMER)
  myOrders(@CurrentUser() user: RequestUser) {
    return this.ordersService.listCustomerOrders(user.sub);
  }

  @Post('orders/track')
  trackGuestOrder(@Body() body: unknown) {
    return this.ordersService.trackGuestOrder(body);
  }

  @Get('orders/:id')
  @UseGuards(OptionalJwtAuthGuard)
  order(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-order-token') guestAccessToken?: string,
  ) {
    return this.ordersService.getOrderForAccess(id, {
      userId: user?.type === UserType.CUSTOMER ? user.sub : null,
      guestAccessToken,
    });
  }

  @Get('store/contact')
  getStoreContact(@Query('currency') currency?: string) {
    return this.settingsService.getPublicContact(currency);
  }

  @Get('store/coupons')
  listActiveCoupons(@Query('currency') currency?: string) {
    return this.couponsService.listActivePublic(currency);
  }

  @Post('orders/:id/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  cancelOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser | undefined,
    @Headers('x-guest-order-token') guestAccessToken?: string,
  ) {
    if (user?.type === UserType.CUSTOMER) {
      return this.ordersService.cancelByCustomer(user.sub, id, body);
    }
    return this.ordersService.cancelByGuest(id, guestAccessToken, body);
  }
}
