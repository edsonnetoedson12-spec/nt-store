import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildPreference, verifySignature, nextOrderStatus } from '../lib/mercadopago.js';

const order = { id: 'abc-123', number: 7, total: 206.73 };
const customer = { name: 'Maria', email: 'm@x.com' };

test('preferência cobra exatamente o total do pedido (desconto e frete já inclusos)', () => {
  const p = buildPreference({ order, customer, method: 'pix', siteUrl: 'https://nt.com.br' });
  assert.equal(p.items.length, 1);
  assert.equal(p.items[0].unit_price, 206.73);
  assert.equal(p.external_reference, 'abc-123');
  assert.equal(p.notification_url, 'https://nt.com.br/api/mercadopago/webhook');
  assert.equal(p.auto_return, 'approved');
});

test('PIX exclui cartão e boleto; cartão exclui PIX', () => {
  const pix = buildPreference({ order, customer, method: 'pix', siteUrl: 'https://nt.com.br' });
  const ids = pix.payment_methods.excluded_payment_types.map((x) => x.id);
  assert.ok(ids.includes('credit_card') && ids.includes('ticket') && !ids.includes('bank_transfer'));
  const card = buildPreference({ order, customer, method: 'cartao', siteUrl: 'https://nt.com.br' });
  const cids = card.payment_methods.excluded_payment_types.map((x) => x.id);
  assert.ok(cids.includes('bank_transfer') && !cids.includes('credit_card'));
});

test('em localhost não envia notification_url nem auto_return', () => {
  const p = buildPreference({ order, customer, method: 'pix', siteUrl: 'http://localhost:3000' });
  assert.equal(p.notification_url, undefined);
  assert.equal(p.auto_return, undefined);
});

test('assinatura do webhook: válida, adulterada e ausente', () => {
  const secret = 's3cret';
  const ts = '1700000000';
  const manifest = `id:12345;request-id:req-1;ts:${ts};`;
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const ok = verifySignature({ secret, signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '12345' });
  assert.equal(ok, true);
  assert.equal(verifySignature({ secret, signatureHeader: `ts=${ts},v1=${'0'.repeat(64)}`, requestId: 'req-1', dataId: '12345' }), false);
  assert.equal(verifySignature({ secret: 'outro', signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: '12345' }), false);
  assert.equal(verifySignature({ secret, signatureHeader: null, requestId: 'req-1', dataId: '12345' }), false);
});

test('status do pedido a partir do pagamento', () => {
  const pending = { id: 'o', status: 'aguardando_pagamento', total: 100 };
  assert.equal(nextOrderStatus({ payment: { status: 'approved', transaction_amount: 100 }, order: pending }), 'pago');
  // valor diferente do pedido: ignora
  assert.equal(nextOrderStatus({ payment: { status: 'approved', transaction_amount: 1 }, order: pending }), null);
  // já pago: não reprocessa
  assert.equal(nextOrderStatus({ payment: { status: 'approved', transaction_amount: 100 }, order: { ...pending, status: 'enviado' } }), null);
  assert.equal(nextOrderStatus({ payment: { status: 'cancelled', transaction_amount: 100 }, order: pending }), 'cancelado');
  // reembolso depois de pago fica para o dono decidir
  assert.equal(nextOrderStatus({ payment: { status: 'refunded', transaction_amount: 100 }, order: { ...pending, status: 'pago' } }), null);
  assert.equal(nextOrderStatus({ payment: { status: 'approved', transaction_amount: 100 }, order: null }), null);
});
