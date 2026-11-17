'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clampQty } from '@/lib/pricing';

export type CartItem = { id: string; slug: string; name: string; image: string; price: number; quantity: number; stock: number };
export type AppliedCoupon = { code: string; discount: number } | null;

type Ctx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  coupon: AppliedCoupon;
  delivery: 'entrega' | 'retirada';
  ready: boolean;
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setCoupon: (c: AppliedCoupon) => void;
  setDelivery: (d: 'entrega' | 'retirada') => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = 'nt-cart-v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<AppliedCoupon>(null);
  const [delivery, setDelivery] = useState<'entrega' | 'retirada'>('entrega');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v.items)) setItems(v.items);
        if (v.coupon) setCoupon(v.coupon);
        if (v.delivery === 'retirada') setDelivery('retirada');
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ items, coupon, delivery }));
    } catch {}
  }, [items, coupon, delivery, ready]);

  const add = useCallback((item: Omit<CartItem, 'quantity'>, qty = 1) => {
    setCoupon(null); // o desconto é recalculado no carrinho
    setItems((prev) => {
      const found = prev.find((i) => i.id === item.id);
      if (found) return prev.map((i) => (i.id === item.id ? { ...i, ...item, quantity: clampQty(i.quantity + qty, item.stock) } : i));
      return [...prev, { ...item, quantity: clampQty(qty, item.stock) }];
    });
  }, []);
  const setQty = useCallback((id: string, qty: number) => {
    setCoupon(null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: clampQty(qty, i.stock) } : i)));
  }, []);
  const remove = useCallback((id: string) => {
    setCoupon(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);
  const clear = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100,
      coupon,
      delivery,
      ready,
      add,
      setQty,
      remove,
      clear,
      setCoupon,
      setDelivery,
    }),
    [items, coupon, delivery, ready, add, setQty, remove, clear],
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): Ctx {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart fora do CartProvider');
  return c;
}
