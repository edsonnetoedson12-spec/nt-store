import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectivePrice, isOnSale, discountPercent, couponDiscount, shippingCost, cartTotals, stockLabel,
} from '../lib/pricing.js';
import { slugify, onlyDigits, whatsappLink } from '../lib/format.js';

test('preço efetivo usa promoção só quando é menor que o preço', () => {
  assert.equal(effectivePrice({ price: 100, promo_price: 80 }), 80);
  assert.equal(effectivePrice({ price: 100, promo_price: null }), 100);
  assert.equal(effectivePrice({ price: 100, promo_price: 0 }), 100);
  assert.equal(effectivePrice({ price: 100, promo_price: 120 }), 100);
  assert.equal(isOnSale({ price: 100, promo_price: 80 }), true);
  assert.equal(discountPercent({ price: 100, promo_price: 80 }), 20);
  assert.equal(discountPercent({ price: 100, promo_price: null }), 0);
});

test('cupom percentual, fixo, mínimo e teto no subtotal', () => {
  assert.equal(couponDiscount(200, { type: 'percent', value: 10 }), 20);
  assert.equal(couponDiscount(200, { type: 'fixed', value: 30 }), 30);
  assert.equal(couponDiscount(20, { type: 'fixed', value: 30 }), 20);
  assert.equal(couponDiscount(100, { type: 'percent', value: 10, min_order: 150 }), 0);
  assert.equal(couponDiscount(100, null), 0);
  assert.equal(couponDiscount(99.99, { type: 'percent', value: 15 }), 15);
});

test('frete fixo e grátis acima do valor', () => {
  const ship = { flat: 15, free_above: 200 };
  assert.equal(shippingCost(100, ship), 15);
  assert.equal(shippingCost(200, ship), 0);
  assert.equal(shippingCost(500, { flat: 15, free_above: 0 }), 15);
  assert.equal(shippingCost(50, undefined), 0);
});

test('totais do carrinho', () => {
  const items = [
    { price: 89.9, promo_price: null, quantity: 2 },
    { price: 59.9, promo_price: 49.9, quantity: 1 },
  ];
  const t = cartTotals(items, { type: 'percent', value: 10 }, { flat: 15, free_above: 300 });
  assert.equal(t.subtotal, 229.7);
  assert.equal(t.discount, 22.97);
  assert.equal(t.shipping, 15);
  assert.equal(t.total, 221.73);
  assert.deepEqual(cartTotals([], null, { flat: 15 }), { subtotal: 0, discount: 0, shipping: 0, total: 0 });
});

test('frete grátis considera o subtotal já com desconto', () => {
  const items = [{ price: 220, promo_price: null, quantity: 1 }];
  const t = cartTotals(items, { type: 'fixed', value: 30 }, { flat: 15, free_above: 200 });
  assert.equal(t.shipping, 15); // 190 < 200
});

test('rótulo de estoque', () => {
  assert.equal(stockLabel(0).tone, 'out');
  assert.equal(stockLabel(2).tone, 'low');
  assert.equal(stockLabel(10).tone, 'ok');
});

test('utilitários de formatação', () => {
  assert.equal(slugify('Colar Elo Mínimal Ação!'), 'colar-elo-minimal-acao');
  assert.equal(onlyDigits('(84) 99999-1234'), '84999991234');
  assert.equal(whatsappLink('(84) 99999-1234', 'Oi'), 'https://wa.me/5584999991234?text=Oi');
});
