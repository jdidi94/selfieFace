'use client';

import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLocale } from '@/lib/locale-context';
import { getMessages } from '@/lib/messages';
import {
  CART_COOKIE_MAX_AGE,
  CART_ID_COOKIE,
  CART_ID_COOKIE_LEGACY,
  GUEST_TOKEN_COOKIE,
  GUEST_TOKEN_COOKIE_LEGACY,
  readCookieMigrating,
  writeCookieMigrating,
} from '@/lib/storefront-cookies';
import type { CartDto, CartStockAdjustmentDto } from '@lumea/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type AddFeedbackStatus = 'adding' | 'added' | 'error';

type AddFeedback = {
  status: AddFeedbackStatus;
  message: string;
};

type CartContextValue = {
  cart: CartDto | null;
  loading: boolean;
  error: string | null;
  stockAdjustments: CartStockAdjustmentDto[];
  clearStockAdjustments: () => void;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  applyLoyalty: (points: number) => Promise<void>;
  removeLoyalty: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function ensureGuestToken() {
  let token = readCookieMigrating(
    GUEST_TOKEN_COOKIE,
    GUEST_TOKEN_COOKIE_LEGACY,
    CART_COOKIE_MAX_AGE,
  );
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '');
    writeCookieMigrating(
      GUEST_TOKEN_COOKIE,
      GUEST_TOKEN_COOKIE_LEGACY,
      token,
      CART_COOKIE_MAX_AGE,
    );
  }
  return token;
}

function isStockError(message: string): boolean {
  return /stock|مخزون|stock insuffisant/i.test(message);
}

function mergeOptimisticQty(cart: CartDto, variantId: string, quantity: number): CartDto | null {
  const idx = cart.items.findIndex((item) => item.variantId === variantId);
  if (idx < 0) return null;
  const item = cart.items[idx]!;
  const nextQty = item.quantity + quantity;
  const delta = item.unitPrice * quantity;
  const items = cart.items.slice();
  items[idx] = {
    ...item,
    quantity: nextQty,
    lineTotal: item.unitPrice * nextQty,
  };
  return {
    ...cart,
    items,
    itemCount: cart.itemCount + quantity,
    subtotal: cart.subtotal + delta,
    total: Math.max(0, cart.total + delta),
  };
}

function CartAddFeedbackBar({ feedback }: { feedback: AddFeedback | null }) {
  if (!feedback) return null;
  const tone =
    feedback.status === 'error'
      ? 'border-destructive/40 bg-destructive text-destructive-foreground'
      : feedback.status === 'added'
        ? 'border-border bg-foreground text-background'
        : 'border-border bg-surface text-foreground';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[70] border-b px-4 py-2 text-center text-sm ${tone}`}
    >
      {feedback.message}
    </div>
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const { currency } = useCurrency();
  const { locale } = useLocale();
  const t = getMessages(locale);
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockAdjustments, setStockAdjustments] = useState<CartStockAdjustmentDto[]>([]);
  const [addFeedback, setAddFeedback] = useState<AddFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartRef = useRef<CartDto | null>(null);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const showFeedback = useCallback((next: AddFeedback, autoHideMs?: number) => {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setAddFeedback(next);
    if (autoHideMs != null) {
      feedbackTimer.current = setTimeout(() => {
        setAddFeedback(null);
        feedbackTimer.current = null;
      }, autoHideMs);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const cartHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const cartId = readCookieMigrating(
      CART_ID_COOKIE,
      CART_ID_COOKIE_LEGACY,
      CART_COOKIE_MAX_AGE,
    );
    const guestToken = ensureGuestToken();
    if (cartId) headers['x-cart-id'] = cartId;
    headers['x-guest-token'] = guestToken;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }, [accessToken]);

  const applyCart = useCallback((next: CartDto) => {
    setCart(next);
    writeCookieMigrating(CART_ID_COOKIE, CART_ID_COOKIE_LEGACY, next.id, CART_COOKIE_MAX_AGE);
    if (next.stockAdjustments?.length) {
      setStockAdjustments(next.stockAdjustments);
    }
  }, []);

  const clearStockAdjustments = useCallback(() => {
    setStockAdjustments([]);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/cart?currency=${currency}`, {
        headers: cartHeaders(),
      });
      if (!res.ok) {
        setCart(null);
        setError('unavailable');
        return;
      }
      const data = (await res.json()) as CartDto;
      setError(null);
      applyCart(data);
    } catch {
      setCart(null);
      setError('unavailable');
    }
  }, [apiUrl, applyCart, cartHeaders, currency]);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const previous = cartRef.current;
      const optimistic =
        previous != null ? mergeOptimisticQty(previous, variantId, quantity) : null;

      if (optimistic) {
        setCart(optimistic);
      }

      showFeedback({ status: 'adding', message: t.addingToBag });

      try {
        const res = await fetch(`${apiUrl}/cart/items`, {
          method: 'POST',
          headers: cartHeaders(),
          body: JSON.stringify({ variantId, quantity, currency }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          const message =
            typeof err.message === 'string' && err.message.trim()
              ? err.message
              : t.addToBagError;
          throw new Error(message);
        }
        applyCart((await res.json()) as CartDto);
        showFeedback({ status: 'added', message: t.addedToBag }, 1800);
      } catch (e) {
        setCart(previous);
        const raw = e instanceof Error ? e.message : t.addToBagError;
        const message = isStockError(raw) ? t.insufficientStock : raw || t.addToBagError;
        showFeedback({ status: 'error', message }, 3200);
        throw new Error(message);
      }
    },
    [applyCart, cartHeaders, currency, showFeedback, t],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!cart) return;
      const res = await fetch(`${apiUrl}/cart/${cart.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: cartHeaders(),
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error('Could not update item');
      applyCart((await res.json()) as CartDto);
    },
    [applyCart, cart, cartHeaders],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!cart) return;
      const res = await fetch(`${apiUrl}/cart/${cart.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: cartHeaders(),
      });
      if (!res.ok) throw new Error('Could not remove item');
      applyCart((await res.json()) as CartDto);
    },
    [applyCart, cart, cartHeaders],
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      if (!cart) return;
      const res = await fetch(`${apiUrl}/cart/${cart.id}/coupon`, {
        method: 'POST',
        headers: cartHeaders(),
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(
          typeof err.message === 'string' ? err.message : 'Could not apply coupon',
        );
      }
      applyCart((await res.json()) as CartDto);
    },
    [applyCart, cart, cartHeaders],
  );

  const removeCoupon = useCallback(async () => {
    if (!cart) return;
    const res = await fetch(`${apiUrl}/cart/${cart.id}/coupon`, {
      method: 'DELETE',
      headers: cartHeaders(),
    });
    if (!res.ok) throw new Error('Could not remove coupon');
    applyCart((await res.json()) as CartDto);
  }, [applyCart, cart, cartHeaders]);

  const applyLoyalty = useCallback(
    async (points: number) => {
      if (!cart) return;
      const res = await fetch(`${apiUrl}/cart/${cart.id}/loyalty`, {
        method: 'POST',
        headers: cartHeaders(),
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(
          typeof err.message === 'string' ? err.message : 'Could not redeem points',
        );
      }
      applyCart((await res.json()) as CartDto);
    },
    [applyCart, cart, cartHeaders],
  );

  const removeLoyalty = useCallback(async () => {
    if (!cart) return;
    const res = await fetch(`${apiUrl}/cart/${cart.id}/loyalty`, {
      method: 'DELETE',
      headers: cartHeaders(),
    });
    if (!res.ok) throw new Error('Could not remove loyalty points');
    applyCart((await res.json()) as CartDto);
  }, [applyCart, cart, cartHeaders]);

  const value = useMemo(
    () => ({
      cart,
      loading,
      error,
      stockAdjustments,
      clearStockAdjustments,
      refresh,
      addItem,
      updateItem,
      removeItem,
      applyCoupon,
      removeCoupon,
      applyLoyalty,
      removeLoyalty,
    }),
    [
      cart,
      loading,
      error,
      stockAdjustments,
      clearStockAdjustments,
      refresh,
      addItem,
      updateItem,
      removeItem,
      applyCoupon,
      removeCoupon,
      applyLoyalty,
      removeLoyalty,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      <CartAddFeedbackBar feedback={addFeedback} />
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
