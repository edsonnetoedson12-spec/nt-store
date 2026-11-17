# NT — Loja virtual de acessórios

E-commerce completo em **Next.js 15 + React 19 + Supabase**, com painel administrativo para gerenciar produtos, estoque, pedidos, clientes, cupons, banners, textos e indicadores financeiros. Tudo que você altera no painel aparece na loja automaticamente.

## O que já vem pronto

**Loja:** página inicial (banner rotativo, frases comerciais, categorias, mais vendidos, novidades, promoções, depoimentos, WhatsApp, rodapé), catálogo com busca/filtros/ordenação, página de produto (galeria, preço promocional, estoque, SEO + dados estruturados), carrinho (quantidades, cupom, frete), checkout (dados do cliente, endereço com busca de CEP, PIX/cartão/WhatsApp), `sitemap.xml` e `robots.txt`.

**Painel `/admin`:** login com e-mail e senha (somente administradores), visão geral com faturamento total/dia/semana/mês, lucro estimado, ticket médio, mais vendidos, gráfico de 14 dias e alerta de estoque baixo; produtos (fotos, preços, promoção, custo, estoque, destaque/lançamento, ocultar); categorias; pedidos com status (aguardando pagamento → pago → em separação → enviado → entregue / cancelado) e código de rastreio; clientes automáticos com histórico e marcação de recorrentes; cupons; depoimentos; configurações (logo, banners, textos, redes sociais, WhatsApp, frete, formas de pagamento).

## Passo a passo para colocar no ar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, execute nesta ordem o conteúdo de:
   - `supabase/migrations/001_schema.sql` (tabelas, segurança, funções, storage)
   - `supabase/seed.sql` (categorias, produtos e textos de exemplo — opcional)
3. Em **Authentication → Users → Add user**, crie o seu usuário (e-mail + senha).
4. De volta ao **SQL Editor**, torne-o administrador (troque pelo seu e-mail):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'SEU-EMAIL@exemplo.com';
   ```
5. (Recomendado) Rode `supabase/tests/smoke.sql` no SQL Editor: ele testa pedido, cupom, estoque, cancelamento e permissões e depois desfaz tudo.
6. Em **Settings → API**, copie a *Project URL*, a *anon key* e a *service_role key*.

### 2. Rodar localmente
```bash
cp .env.example .env.local     # preencha as chaves do Supabase
npm install
npm run dev                    # http://localhost:3000   |   painel: /admin
npm test                       # testes da lógica de preços, cupom, frete e métricas
```

### 3. Publicar
Suba o projeto na [Vercel](https://vercel.com) (importando o repositório), cadastre as mesmas variáveis de ambiente e ajuste `NEXT_PUBLIC_SITE_URL` para o endereço do site.

### 4. Mercado Pago (PIX e cartão)
1. Crie uma aplicação em *Mercado Pago → Suas integrações* e copie o **Access Token** para `MERCADOPAGO_ACCESS_TOKEN`.
2. O site já cria o pagamento (Checkout Pro) e recebe a confirmação em `/api/mercadopago/webhook`, que muda o pedido para **Pago** automaticamente. Em *Webhooks* da aplicação, o endereço é `https://SEU-SITE/api/mercadopago/webhook` (evento “Pagamentos”). O retorno automático exige site em **https**; em `localhost` o pagamento abre, mas o redirecionamento de volta não funciona.
3. Sem o token, os pedidos entram como **Aguardando pagamento** e você combina pelo WhatsApp; troque o status manualmente no painel.

## Como a segurança funciona
- **RLS no banco:** visitantes só leem produtos ativos, categorias, configurações e depoimentos. Pedidos, clientes e cupons só são acessíveis ao administrador.
- **Compra pelo servidor:** a função `create_order` recalcula preço (inclusive promoção), cupom, frete e estoque dentro do banco; valores enviados pelo navegador são ignorados. O estoque é bloqueado durante a compra (evita vender o mesmo item duas vezes) e devolvido ao cancelar.
- **Painel:** `/admin` exige login e checagem de administrador (middleware + layout + RLS). A chave `service_role` só é usada no servidor (webhook).
- **Imagens:** só administradores enviam ao bucket `store` (JPG/PNG/WEBP/GIF/SVG até 5 MB).

## Observações
- Lucro estimado = Σ (preço − custo) × quantidade − cupons. O frete é tratado como repasse. Só pedidos pagos/em andamento contam como venda.
- A vitrine é atualizada na hora quando você salva no painel (e, no máximo, a cada 30 s por cache).
- As imagens em `public/placeholders` são exemplos; substitua pelas suas fotos no painel.
- Sugestões para crescer: cálculo de frete por CEP (Correios/Melhor Envio), e-mails transacionais, variações de produto (tamanho/cor).
