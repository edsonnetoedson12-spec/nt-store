import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitPrice, hasPromo, discountPercent, couponDiscount, shippingCost, orderTotals, clampQty } from '../src/lib/pricing';
import { slugify, onlyDigits, formatPhone, whatsappNumber, brl } from '../src/lib/format';

const ship = { flat: 19.9, free_above: 199, pickup: true };

test('preço promocional só vale se for menor que o preço normal', () => {
  assert.equal(unitPrice({ price: 100, promo_price: 80 }), 80);
  assert.equal(unitPrice({ price: 100, promo_price: null }), 100);
  assert.equal(unitPrice({ price: 100, promo_price: 120 }), 100);
  assert.equal(unitPrice({ price: 100, promo_price: 0 }), 100);
  assert.equal(hasPromo({ price: 100, promo_price: 99.9 }), true);
  assert.equal(discountPercent({ price: 200, promo_price: 150 }), 25);
  assert.equal(discountPercent({ price: 200, promo_price: null }), 0);
});

test('cupom percentual e fixo respeitam pedido mínimo e limite', () => {
  assert.equal(couponDiscount({ type: 'percent', value: 10, min_order: 0 }, 199.9), 19.99);
  assert.equal(couponDiscount({ type: 'fixed', value: 20, min_order: 150 }, 149.99), 0);
  assert.equal(couponDiscount({ type: 'fixed', value: 20, min_order: 150 }, 150), 20);
  assert.equal(couponDiscount({ type: 'fixed', value: 50, min_order: 0 }, 30), 30);
  assert.equal(couponDiscount({ type: 'percent', value: 150, min_order: 0 }, 100), 100);
  assert.equal(couponDiscount(null, 100), 0);
});

test('frete: fixo, grátis acima do mínimo, retirada sempre zero', () => {
  assert.equal(shippingCost(ship, 100, 'entrega'), 19.9);
  assert.equal(shippingCost(ship, 199, 'entrega'), 0);
  assert.equal(shippingCost(ship, 198.99, 'entrega'), 19.9);
  assert.equal(shippingCost(ship, 10, 'retirada'), 0);
  assert.equal(shippingCost({ flat: 15, free_above: 0, pickup: true }, 9999, 'entrega'), 15);
});

test('total do pedido: subtotal - desconto + frete (frete grátis considera o desconto)', () => {
  const lines = [{ price: 89.9, quantity: 2 }, { price: 119.9, quantity: 1 }];
  const t = orderTotals(lines, 0, ship, 'entrega');
  assert.deepEqual(t, { subtotal: 299.7, discount: 0, shipping: 0, total: 299.7 });
  // com cupom que derruba abaixo de 199 => frete passa a ser cobrado
  const t2 = orderTotals([{ price: 210, quantity: 1 }], 20, ship, 'entrega');
  assert.deepEqual(t2, { subtotal: 210, discount: 20, shipping: 19.9, total: 209.9 });
  assert.deepEqual(orderTotals([], 0, ship, 'entrega'), { subtotal: 0, discount: 0, shipping: 0, total: 0 });
  // erro clássico de ponto flutuante
  assert.equal(orderTotals([{ price: 0.1, quantity: 3 }], 0, { flat: 0, free_above: 0, pickup: true }, 'retirada').total, 0.3);
});

test('quantidade respeita estoque e limites', () => {
  assert.equal(clampQty(5, 3), 3);
  assert.equal(clampQty(0, 3), 1);
  assert.equal(clampQty(-2, 3), 1);
  assert.equal(clampQty(200, 500), 99);
  assert.equal(clampQty(NaN, 5), 1);
});

test('formatação e slug', () => {
  assert.equal(slugify('Brincos Lua Cheia!'), 'brincos-lua-cheia');
  assert.equal(slugify('  Anéis & Pulseiras  '), 'aneis-pulseiras');
  assert.equal(onlyDigits('(85) 99999-9999'), '85999999999');
  assert.equal(formatPhone('85999999999'), '(85) 99999-9999');
  assert.equal(formatPhone('5585999999999'), '(85) 99999-9999');
  assert.equal(whatsappNumber('(85) 99999-9999'), '5585999999999');
  assert.equal(whatsappNumber('+55 85 99999-9999'), '5585999999999');
  assert.match(brl(1234.5), /1\.234,50/);
});
