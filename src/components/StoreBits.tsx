'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from './CartProvider';
import type { Banner, Product } from '@/lib/types';
import { whatsappNumber } from '@/lib/format';

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link href="/carrinho" className="icon-btn" aria-label={`Carrinho${ready ? `, ${count} itens` : ''}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 7h12l-1 13H7L6 7z" />
        <path d="M9 7a3 3 0 016 0" />
      </svg>
      {ready && count > 0 && <span className="badge">{count}</span>}
    </Link>
  );
}

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  return (
    <>
      <button className="icon-btn menu-btn" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div className="drawer" role="dialog" aria-modal="true">
          <button className="drawer-close" aria-label="Fechar menu" onClick={() => setOpen(false)}>
            ×
          </button>
          <nav>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

export function HeroSlider({ banners, title, subtitle, cta }: { banners: Banner[]; title: string; subtitle: string; cta: string }) {
  const [i, setI] = useState(0);
  const n = banners.length;
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n]);
  const b = banners[i];
  return (
    <section className="hero" aria-roledescription="carousel">
      {banners.map((bn, idx) => (
        <div key={idx} className={`hero-slide${idx === i ? ' on' : ''}`} style={{ backgroundImage: `url(${bn.image})` }} aria-hidden={idx !== i} />
      ))}
      <div className="hero-inner">
        <p className="eyebrow">{b?.title || 'NT Acessórios'}</p>
        <h1>{title}</h1>
        <p className="lead">{b?.subtitle || subtitle}</p>
        <Link href={b?.link || '/loja'} className="btn btn-gold">
          {cta}
        </Link>
      </div>
      {n > 1 && (
        <div className="dots">
          {banners.map((_, idx) => (
            <button key={idx} aria-label={`Banner ${idx + 1}`} className={idx === i ? 'on' : ''} onClick={() => setI(idx)} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AddToCart({ product, big = false }: { product: Product; big?: boolean }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const price = product.promo_price != null && product.promo_price < product.price ? product.promo_price : product.price;
  const out = product.stock <= 0;
  const go = () => {
    add({ id: product.id, slug: product.slug, name: product.name, image: product.images[0] || '', price, stock: product.stock }, qty);
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <div className={big ? 'atc big' : 'atc'}>
      {big && !out && (
        <div className="qty" aria-label="Quantidade">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">−</button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Aumentar">+</button>
        </div>
      )}
      <button className="btn btn-dark" disabled={out} onClick={go}>
        {out ? 'Esgotado' : done ? 'Adicionado ✓' : 'Adicionar ao carrinho'}
      </button>
    </div>
  );
}

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const list = images.length ? images : ['/placeholders/ring.svg'];
  return (
    <div className="gallery">
      <div className="gallery-main">
        <img src={list[i]} alt={alt} />
      </div>
      {list.length > 1 && (
        <div className="thumbs">
          {list.map((src, idx) => (
            <button key={src + idx} className={idx === i ? 'on' : ''} onClick={() => setI(idx)} aria-label={`Foto ${idx + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WhatsAppFloat({ phone, name }: { phone: string; name: string }) {
  const n = whatsappNumber(phone);
  if (!n) return null;
  const href = `https://wa.me/${n}?text=${encodeURIComponent(`Olá, ${name}! Gostaria de ajuda com os acessórios.`)}`;
  return (
    <a className="wa-float" href={href} target="_blank" rel="noopener noreferrer" aria-label="Atendimento pelo WhatsApp">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.7a2.7 2.7 0 001.8-1.3 2.2 2.2 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" />
      </svg>
    </a>
  );
}
