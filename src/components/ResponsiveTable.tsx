'use client';
import { useEffect, useRef } from 'react';

/** Tabela que no celular vira uma lista de cartões. Copia o título de cada coluna para cada célula. */
export default function ResponsiveTable({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = ref.current?.querySelector('table');
    if (!t) return;
    const heads = Array.from(t.querySelectorAll('thead th')).map((h) => (h.textContent || '').trim());
    t.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.children) as HTMLElement[];
      if (cells.length === 1) return; // linhas de detalhe ou de "vazio"
      cells.forEach((c, i) => c.setAttribute('data-label', heads[i] || ''));
    });
  });
  return (
    <div className="table-wrap cards" ref={ref}>
      {children}
    </div>
  );
}
