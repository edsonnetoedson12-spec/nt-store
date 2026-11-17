-- Dados iniciais (opcional). Execute depois de 001_schema.sql.
-- Tudo aqui pode ser editado/removido depois pelo painel administrativo.

insert into public.categories (name, slug, sort) values
  ('Brincos',   'brincos',   1),
  ('Colares',   'colares',   2),
  ('Anéis',     'aneis',     3),
  ('Pulseiras', 'pulseiras', 4),
  ('Relógios',  'relogios',  5),
  ('Óculos',    'oculos',    6),
  ('Bolsas',    'bolsas',    7)
on conflict (slug) do nothing;

insert into public.products (name, slug, description, price, promo_price, cost, stock, category_id, images, featured, is_new, sold_count)
select v.name, v.slug, v.description, v.price, v.promo, v.cost, v.stock, c.id, array[v.img], v.featured, v.is_new, v.sold
from (values
  ('Brincos Aurora', 'brincos-aurora', 'Brincos delicados banhados a ouro 18k, acabamento brilhante e hipoalergênico.', 89.90, null::numeric, 32.00, 25, 'brincos', '/placeholders/earrings.svg', true,  false, 41),
  ('Brincos Lua Cheia', 'brincos-lua-cheia', 'Argolas finas com zircônias que refletem a luz em qualquer ocasião.', 79.90, 64.90, 28.00, 18, 'brincos', '/placeholders/earrings-2.svg', false, true, 12),
  ('Colar Ponto de Luz', 'colar-ponto-de-luz', 'Colar minimalista com pingente de zircônia. Corrente de 45 cm.', 119.90, null, 44.00, 20, 'colares', '/placeholders/necklace.svg', true, false, 37),
  ('Colar Pérola Clássica', 'colar-perola-classica', 'Pérolas cultivadas com fecho dourado. Elegância atemporal.', 149.90, 129.90, 58.00, 12, 'colares', '/placeholders/necklace-2.svg', true, true, 22),
  ('Anel Solitário Imperial', 'anel-solitario-imperial', 'Anel ajustável com pedra central em cristal lapidado.', 99.90, null, 35.00, 30, 'aneis', '/placeholders/ring.svg', false, true, 18),
  ('Anel Trilho Dourado', 'anel-trilho-dourado', 'Aliança fina em aço banhado a ouro, resistente à água.', 69.90, 54.90, 22.00, 40, 'aneis', '/placeholders/ring-2.svg', false, false, 29),
  ('Pulseira Elos Finos', 'pulseira-elos-finos', 'Pulseira em elos finos com fecho lagosta. Combina com tudo.', 109.90, null, 40.00, 22, 'pulseiras', '/placeholders/bracelet.svg', true, false, 26),
  ('Relógio Minimal Rosé', 'relogio-minimal-rose', 'Relógio analógico em aço rosé, caixa de 34 mm, resistente a respingos.', 289.90, 249.90, 120.00, 8, 'relogios', '/placeholders/watch.svg', true, true, 15),
  ('Óculos Solar Havana', 'oculos-solar-havana', 'Armação acetato com lentes polarizadas e proteção UV400.', 199.90, null, 70.00, 14, 'oculos', '/placeholders/sunglasses.svg', false, true, 9),
  ('Bolsa Mini Noir', 'bolsa-mini-noir', 'Bolsa estruturada com alça removível e ferragens douradas.', 259.90, 219.90, 98.00, 6, 'bolsas', '/placeholders/bag.svg', true, false, 19)
) as v(name, slug, description, price, promo, cost, stock, cat, img, featured, is_new, sold)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

insert into public.testimonials (name, text, rating) values
  ('Mariana S.', 'Peças lindas e com acabamento impecável. A embalagem é um charme e chegou antes do prazo!', 5),
  ('Camila R.', 'Comprei o colar de pérolas e recebi vários elogios. Atendimento pelo WhatsApp muito atencioso.', 5),
  ('Juliana P.', 'Qualidade premium por um preço justo. Já é a terceira vez que compro na NT.', 5);

insert into public.coupons (code, type, value, min_order, active) values
  ('BEMVINDO10', 'percent', 10, 0, true),
  ('NT20', 'fixed', 20, 150, true)
on conflict (code) do nothing;

insert into public.settings (key, value) values ('store', $json$
{
  "name": "NT",
  "tagline": "Acessórios que contam a sua história",
  "logo_url": "",
  "whatsapp": "5585999999999",
  "email": "contato@nt.com.br",
  "phone": "(85) 99999-9999",
  "address": "Fortaleza - CE",
  "instagram": "https://instagram.com/",
  "facebook": "https://facebook.com/",
  "tiktok": "",
  "phrases": ["Frete grátis acima de R$ 199", "Pague com PIX ou cartão em até 12x", "Peças selecionadas com acabamento premium"],
  "hero": { "title": "Acessórios para brilhar todos os dias", "subtitle": "Design sofisticado, qualidade premium e preço justo.", "cta": "Ver coleção" },
  "banners": [
    { "image": "/placeholders/banner-1.svg", "title": "Nova coleção", "subtitle": "Peças delicadas para o seu dia a dia", "link": "/loja?novidades=1" },
    { "image": "/placeholders/banner-2.svg", "title": "Ofertas NT", "subtitle": "Promoções por tempo limitado", "link": "/loja?promocao=1" }
  ],
  "sections": { "bestsellers": "Mais vendidos", "news": "Novidades", "promo": "Promoções", "categories": "Compre por categoria", "testimonials": "O que dizem nossas clientes" },
  "shipping": { "flat": 19.9, "free_above": 199, "pickup": true },
  "payments": { "pix": true, "cartao": true, "whatsapp": true },
  "about": "A NT nasceu para transformar acessórios em declarações de estilo. Cada peça é escolhida com cuidado, pensando em quem gosta de elegância sem exageros."
}
$json$::jsonb)
on conflict (key) do nothing;
