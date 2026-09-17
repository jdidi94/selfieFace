'use client';

import { apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import type { CartDto, CartStockAdjustmentDto } from '@lumea/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const CART_ID_COOKIE = 'lumea_cart_id';
const GUEST_TOKEN_COOKIE = 'lumea_guest_token';

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

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
}

function ensureGuestToken() {
  let token = readCookie(GUEST_TOKEN_COOKIE);
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '');
    writeCookie(GUEST_TOKEN_COOKIE, token);
  }
  return token;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const { currency } = useCurrency();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockAdjustments, setStockAdjustments] = useState<CartStockAdjustmentDto[]>([]);

  const cartHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const cartId = readCookie(CART_ID_COOKIE);
    const guestToken = ensureGuestToken();
    if (cartId) headers['x-cart-id'] = cartId;
    headers['x-guest-token'] = guestToken;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }, [accessToken]);

  const applyCart = useCallback((next: CartDto) => {
    setCart(next);
    writeCookie(CART_ID_COOKIE, next.id);
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
      const res = await fetch(`${apiUrl}/cart/items`, {
        method: 'POST',
        headers: cartHeaders(),
        body: JSON.stringify({ variantId, quantity, currency }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Could not add to bag');
      }
      applyCart((await res.json()) as CartDto);
    },
    [applyCart, cartHeaders, currency],
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
