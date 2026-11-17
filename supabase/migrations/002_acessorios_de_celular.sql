-- NT: troca os dados de exemplo (bijuteria) por acessórios de celular.
-- Cole tudo no SQL Editor do Supabase e clique em Run. Apaga os PRODUTOS, CATEGORIAS e DEPOIMENTOS atuais.
-- Pedidos e clientes já feitos NÃO são apagados (o histórico mantém o nome do produto).

delete from public.products;
delete from public.categories;
delete from public.testimonials;

insert into public.categories (name, slug, sort) values
  ('Capas', 'capas', 1),
  ('Películas', 'peliculas', 2),
  ('Carregadores', 'carregadores', 3),
  ('Cabos', 'cabos', 4),
  ('Fones de ouvido', 'fones', 5),
  ('Power banks', 'power-banks', 6),
  ('Suportes', 'suportes', 7)
on conflict (slug) do nothing;

insert into public.products (name, slug, description, price, promo_price, cost, stock, category_id, images, featured, is_new, sold_count)
select v.name, v.slug, v.description, v.price, v.promo, v.cost, v.stock, c.id, array[v.img], v.featured, v.is_new, v.sold
from (values
  ('Capa Silicone Premium', 'capa-silicone-premium', 'Capa de silicone macio com forro em microfibra, protege contra quedas e arranhões. Toque aveludado e bordas elevadas.', 29.90, null::numeric, 8.00, 60, 'capas', '/placeholders/case.svg', true, false, 52),
  ('Capa Transparente Anti-Impacto', 'capa-transparente-anti-impacto', 'Capa transparente com cantos reforçados que absorvem impacto. Não amarela e deixa o design do aparelho à mostra.', 39.90, 29.90, 10.00, 45, 'capas', '/placeholders/case.svg', false, true, 38),
  ('Capa Carteira em Couro', 'capa-carteira-couro', 'Capa tipo carteira com compartimento para cartões e função de apoio. Fechamento magnético.', 59.90, null, 20.00, 25, 'capas', '/placeholders/case.svg', false, false, 14),
  ('Película de Vidro 3D', 'pelicula-vidro-3d', 'Película de vidro temperado 9H com cobertura de borda a borda. Alta transparência e fácil aplicação.', 24.90, null, 5.00, 80, 'peliculas', '/placeholders/film.svg', true, false, 71),
  ('Película Privacidade', 'pelicula-privacidade', 'Película de vidro que impede a visualização lateral da tela. Proteção 9H contra riscos.', 34.90, 27.90, 9.00, 35, 'peliculas', '/placeholders/film.svg', false, true, 19),
  ('Película para Câmera', 'pelicula-camera', 'Protetor de lente em vidro temperado. Mantém a qualidade das fotos e evita riscos na câmera.', 14.90, null, 3.00, 70, 'peliculas', '/placeholders/film.svg', false, false, 33),
  ('Carregador Turbo 20W USB-C', 'carregador-turbo-20w', 'Carregador de parede com carregamento rápido de 20W. Chip de proteção contra superaquecimento e sobrecarga.', 69.90, 59.90, 25.00, 40, 'carregadores', '/placeholders/charger.svg', true, false, 46),
  ('Carregador Veicular Duplo', 'carregador-veicular-duplo', 'Carregador para carro com duas saídas USB. Carrega dois aparelhos ao mesmo tempo com segurança.', 44.90, null, 15.00, 30, 'carregadores', '/placeholders/charger.svg', false, false, 21),
  ('Carregador sem Fio 15W', 'carregador-sem-fio-15w', 'Base de carregamento por indução de 15W, compatível com os principais aparelhos. Design fino com LED indicador.', 89.90, null, 32.00, 20, 'carregadores', '/placeholders/wireless.svg', false, true, 12),
  ('Cabo USB-C Reforçado 1,5 m', 'cabo-usb-c-reforcado', 'Cabo trançado de alta resistência com carga rápida e transferência de dados. Conectores reforçados.', 29.90, null, 8.00, 90, 'cabos', '/placeholders/cable.svg', true, false, 64),
  ('Cabo Lightning Certificado 1 m', 'cabo-lightning-1m', 'Cabo para iPhone com chip de certificação e carregamento rápido. Revestimento flexível e durável.', 39.90, null, 12.00, 50, 'cabos', '/placeholders/cable.svg', false, false, 27),
  ('Fone Bluetooth TWS', 'fone-bluetooth-tws', 'Fone sem fio com estojo carregador, som estéreo e microfone integrado. Até 20 horas de uso com o estojo.', 99.90, 79.90, 35.00, 28, 'fones', '/placeholders/earbuds.svg', true, true, 31),
  ('Fone de Ouvido com Fio P2', 'fone-com-fio-p2', 'Fone intra-auricular com microfone e botão de atendimento. Som nítido e cabo resistente.', 19.90, null, 5.00, 60, 'fones', '/placeholders/earbuds.svg', false, false, 25),
  ('Power Bank 10.000 mAh', 'power-bank-10000', 'Carregador portátil com duas saídas USB e entrada USB-C. Indicador de carga em LED.', 119.90, null, 45.00, 18, 'power-banks', '/placeholders/powerbank.svg', true, false, 22),
  ('Suporte Veicular Magnético', 'suporte-veicular-magnetico', 'Suporte para painel ou saída de ar com base magnética forte e giro de 360°. Compatível com a maioria dos celulares.', 34.90, null, 10.00, 35, 'suportes', '/placeholders/holder.svg', false, false, 17)
) as v(name, slug, description, price, promo, cost, stock, cat, img, featured, is_new, sold)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

insert into public.testimonials (name, text, rating) values
  ('Mariana S.', 'Chegou rápido e bem embalado. A capa encaixou perfeitamente e a película veio com kit de aplicação.', 5),
  ('Rafael P.', 'O carregador turbo carrega muito mais rápido que o antigo. Preço justo e atendimento ótimo pelo WhatsApp.', 5),
  ('Camila R.', 'Já é a terceira compra na NT. Produtos de qualidade e entrega no prazo.', 5);

update public.settings set value = value || $json$
{
  "tagline": "Acessórios para celular com qualidade e preço justo",
  "phrases": ["Frete grátis acima de R$ 199", "Pague com PIX ou cartão em até 12x", "Produtos testados e com garantia"],
  "hero": { "title": "Tudo para o seu celular em um só lugar", "subtitle": "Capas, películas, carregadores e muito mais, com preço justo e envio rápido.", "cta": "Ver produtos" },
  "sections": { "bestsellers": "Mais vendidos", "news": "Novidades", "promo": "Promoções", "categories": "Compre por categoria", "testimonials": "O que dizem nossos clientes" },
  "about": "A NT é especializada em acessórios para celular: capas, películas, carregadores, cabos e fones. Trabalhamos com produtos selecionados, boa procedência e atendimento direto pelo WhatsApp."
}
$json$::jsonb, updated_at = now() where key = 'store';
-- banners de exemplo atualizados (só se ainda forem os de exemplo)
update public.settings set value = jsonb_set(value, '{banners}', $json$[
  { "image": "/placeholders/banner-1.svg", "title": "Novidades", "subtitle": "Os lançamentos que chegaram na NT", "link": "/loja?novidades=1" },
  { "image": "/placeholders/banner-2.svg", "title": "Ofertas NT", "subtitle": "Promoções por tempo limitado", "link": "/loja?promocao=1" }
]$json$::jsonb) where key = 'store' and value::text like '%/placeholders/banner-%';
