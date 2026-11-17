'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { num, refreshStore, uploadImage } from '@/lib/admin';
import { DEFAULT_SETTINGS } from '@/lib/data-defaults';
import type { Banner, StoreSettings } from '@/lib/types';

export default function SettingsAdmin() {
  const sb = createClient();
  const [s, setS] = useState<StoreSettings | null>(null);
  const [flat, setFlat] = useState('0');
  const [free, setFree] = useState('0');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sb.from('settings').select('value').eq('key', 'store').maybeSingle().then(({ data }) => {
      const v = (data?.value ?? {}) as Partial<StoreSettings>;
      const merged: StoreSettings = {
        ...DEFAULT_SETTINGS, ...v,
        hero: { ...DEFAULT_SETTINGS.hero, ...v.hero }, sections: { ...DEFAULT_SETTINGS.sections, ...v.sections },
        shipping: { ...DEFAULT_SETTINGS.shipping, ...v.shipping }, payments: { ...DEFAULT_SETTINGS.payments, ...v.payments },
      };
      setS(merged); setFlat(String(merged.shipping.flat)); setFree(String(merged.shipping.free_above));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <p className="muted">Carregando…</p>;
  const up = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS({ ...s, [k]: v });
  const txt = (k: 'name' | 'tagline' | 'whatsapp' | 'email' | 'phone' | 'address' | 'instagram' | 'facebook' | 'tiktok' | 'about') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => up(k, e.target.value);

  async function pick(file: File | undefined, folder: string, apply: (url: string) => void) {
    if (!file) return;
    setBusy(true);
    try { apply(await uploadImage(file, folder)); } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : 'Falha no envio' }); }
    setBusy(false);
  }
  const setBanner = (i: number, patch: Partial<Banner>) => up('banners', s.banners.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const value: StoreSettings = {
      ...s!, whatsapp: s!.whatsapp.replace(/\D/g, ''),
      phrases: s!.phrases.map((p) => p.trim()).filter(Boolean),
      shipping: { ...s!.shipping, flat: num(flat), free_above: num(free) },
    };
    const { error } = await sb.from('settings').upsert({ key: 'store', value, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) return setMsg({ ok: false, t: error.message });
    setMsg({ ok: true, t: 'Configurações salvas. A loja já foi atualizada.' });
    refreshStore();
  }

  return (
    <form onSubmit={save} className="settings">
      <div className="adm-head">
        <h1 className="adm-title">Configurações da loja</h1>
        <button className="btn btn-dark sm" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar tudo'}</button>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.t}</p>}

      <fieldset className="box">
        <legend>Marca e empresa</legend>
        <div className="two">
          <label>Nome da loja<input value={s.name} onChange={txt('name')} /></label>
          <label>Slogan<input value={s.tagline} onChange={txt('tagline')} /></label>
        </div>
        <div className="logo-edit">
          {s.logo_url ? <img src={s.logo_url} alt="Logo" height={48} /> : <span className="logo-mark">{s.name}</span>}
          <label className="btn btn-light sm">Enviar logo<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], 'branding', (u) => up('logo_url', u))} /></label>
          {s.logo_url && <button type="button" className="link danger" onClick={() => up('logo_url', '')}>Remover logo</button>}
        </div>
        <label>Sobre a empresa (aparece no rodapé)<textarea rows={3} value={s.about} onChange={txt('about')} /></label>
        <div className="three">
          <label>E-mail<input type="email" value={s.email} onChange={txt('email')} /></label>
          <label>Telefone<input value={s.phone} onChange={txt('phone')} /></label>
          <label>Cidade/endereço<input value={s.address} onChange={txt('address')} /></label>
        </div>
      </fieldset>

      <fieldset className="box">
        <legend>WhatsApp e redes sociais</legend>
        <label>WhatsApp (com DDD, ex.: 85999999999)<input value={s.whatsapp} onChange={txt('whatsapp')} inputMode="tel" /></label>
        <div className="three">
          <label>Instagram (link)<input value={s.instagram} onChange={txt('instagram')} /></label>
          <label>Facebook (link)<input value={s.facebook} onChange={txt('facebook')} /></label>
          <label>TikTok (link)<input value={s.tiktok} onChange={txt('tiktok')} /></label>
        </div>
      </fieldset>

      <fieldset className="box">
        <legend>Página inicial</legend>
        <label>Título principal<input value={s.hero.title} onChange={(e) => up('hero', { ...s.hero, title: e.target.value })} /></label>
        <label>Subtítulo<input value={s.hero.subtitle} onChange={(e) => up('hero', { ...s.hero, subtitle: e.target.value })} /></label>
        <label>Texto do botão<input value={s.hero.cta} onChange={(e) => up('hero', { ...s.hero, cta: e.target.value })} /></label>
        <label>Frases comerciais (uma por linha; a primeira aparece no topo do site)
          <textarea rows={4} value={s.phrases.join('\n')} onChange={(e) => up('phrases', e.target.value.split('\n'))} />
        </label>
        <div className="two">
          <label>Título: mais vendidos<input value={s.sections.bestsellers} onChange={(e) => up('sections', { ...s.sections, bestsellers: e.target.value })} /></label>
          <label>Título: novidades<input value={s.sections.news} onChange={(e) => up('sections', { ...s.sections, news: e.target.value })} /></label>
          <label>Título: promoções<input value={s.sections.promo} onChange={(e) => up('sections', { ...s.sections, promo: e.target.value })} /></label>
          <label>Título: categorias<input value={s.sections.categories} onChange={(e) => up('sections', { ...s.sections, categories: e.target.value })} /></label>
        </div>
      </fieldset>

      <fieldset className="box">
        <legend>Banners</legend>
        {s.banners.map((b, i) => (
          <div className="banner-edit" key={i}>
            <div className="banner-prev" style={{ backgroundImage: `url(${b.image})` }} />
            <div className="banner-fields">
              <label className="btn btn-light sm">Trocar imagem<input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], 'banners', (u) => setBanner(i, { image: u }))} /></label>
              <label>Título<input value={b.title} onChange={(e) => setBanner(i, { title: e.target.value })} /></label>
              <label>Subtítulo<input value={b.subtitle} onChange={(e) => setBanner(i, { subtitle: e.target.value })} /></label>
              <label>Link do botão<input value={b.link} onChange={(e) => setBanner(i, { link: e.target.value })} placeholder="/loja" /></label>
              <button type="button" className="link danger" onClick={() => up('banners', s.banners.filter((_, k) => k !== i))}>Remover banner</button>
            </div>
          </div>
        ))}
        <label className="btn btn-light sm">+ Novo banner
          <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], 'banners', (u) => up('banners', [...s.banners, { image: u, title: '', subtitle: '', link: '/loja' }]))} />
        </label>
        <small className="muted">Tamanho recomendado: 1600×700 px.</small>
      </fieldset>

      <fieldset className="box">
        <legend>Frete e pagamentos</legend>
        <div className="three">
          <label>Frete fixo (R$)<input inputMode="decimal" value={flat} onChange={(e) => setFlat(e.target.value)} /></label>
          <label>Frete grátis acima de (R$, 0 = nunca)<input inputMode="decimal" value={free} onChange={(e) => setFree(e.target.value)} /></label>
          <label className="check pad"><input type="checkbox" checked={s.shipping.pickup} onChange={(e) => up('shipping', { ...s.shipping, pickup: e.target.checked })} /> Permitir retirada na loja</label>
        </div>
        <div className="checks">
          <label><input type="checkbox" checked={s.payments.pix} onChange={(e) => up('payments', { ...s.payments, pix: e.target.checked })} /> PIX (Mercado Pago)</label>
          <label><input type="checkbox" checked={s.payments.cartao} onChange={(e) => up('payments', { ...s.payments, cartao: e.target.checked })} /> Cartão de crédito (Mercado Pago)</label>
          <label><input type="checkbox" checked={s.payments.whatsapp} onChange={(e) => up('payments', { ...s.payments, whatsapp: e.target.checked })} /> Combinar pelo WhatsApp</label>
        </div>
        <small className="muted">Cupons: menu “Cupons”. O valor do frete e as regras são sempre conferidos no servidor.</small>
      </fieldset>
    </form>
  );
}
