'use client';

/**
 * Gráficos leves em SVG (sem biblioteca) para funcionar offline e rápido em
 * celular simples. Cores da paleta DRAP: folha para entradas/positivo,
 * terra para saídas, tinta para o saldo.
 */

import { useState } from 'react';

const LEAF = '#486B3A';
const EARTH = '#7A5C3B';
const INK = '#111410';
const RULE = '#C8C2B2';
const MUTED = '#5A5A54';

function escala(min: number, max: number, a: number, b: number) {
  const span = max - min || 1;
  return (v: number) => a + ((v - min) / span) * (b - a);
}

function compacto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export interface PontoBarras { rotulo: string; a: number; b: number; linha?: number; destaque?: boolean }

/** Barras pareadas (entradas × saídas) com linha de saldo. */
export function BarrasFluxo({ dados, legendaA = 'Entradas', legendaB = 'Saídas', legendaLinha = 'Saldo', altura = 220, formatar = compacto }: {
  dados: PontoBarras[]; legendaA?: string; legendaB?: string; legendaLinha?: string; altura?: number; formatar?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = altura;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const valores = dados.flatMap((d) => [d.a, d.b, d.linha ?? 0, 0]);
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const y = escala(min, max, H - pad.b, pad.t);
  const slot = (W - pad.l - pad.r) / Math.max(1, dados.length);
  const bw = Math.min(16, slot * 0.3);
  const linha = dados.map((d, i) => d.linha == null ? null : `${pad.l + slot * i + slot / 2},${y(d.linha)}`).filter(Boolean).join(' ');
  const h = hover != null ? dados[hover] : null;
  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de fluxo">
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke={RULE} />
          {dados.map((d, i) => {
            const cx = pad.l + slot * i + slot / 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill={hover === i ? 'rgba(234,223,206,0.45)' : 'transparent'} />
                <rect x={cx - bw - 1} y={Math.min(y(d.a), y(0))} width={bw} height={Math.abs(y(0) - y(d.a))} fill={LEAF} opacity={d.destaque ? 0.55 : 1} rx={1} />
                <rect x={cx + 1} y={Math.min(y(d.b), y(0))} width={bw} height={Math.abs(y(0) - y(d.b))} fill={EARTH} opacity={d.destaque ? 0.55 : 1} rx={1} />
                <text x={cx} y={H - 9} textAnchor="middle" fontSize="11" fill={MUTED} fontFamily="var(--font-manrope)">{d.rotulo}</text>
              </g>
            );
          })}
          {linha ? <polyline points={linha} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="0" /> : null}
          {dados.map((d, i) => d.linha == null ? null : (
            <circle key={i} cx={pad.l + slot * i + slot / 2} cy={y(d.linha)} r={hover === i ? 4 : 2.5} fill={INK} pointerEvents="none" />
          ))}
        </svg>
        {h ? (
          <div className="pointer-events-none absolute right-2 top-0 rounded-sm border border-rule bg-bone px-3 py-2 text-[12px] shadow-card">
            <div className="eyebrow mb-1">{h.rotulo}{h.destaque ? ' · projetado' : ''}</div>
            <div className="num text-leafDk">{legendaA}: {formatar(h.a)}</div>
            <div className="num text-earth">{legendaB}: {formatar(h.b)}</div>
            {h.linha != null ? <div className="num text-ink">{legendaLinha}: {formatar(h.linha)}</div> : null}
          </div>
        ) : null}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEAF }} />{legendaA}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: EARTH }} />{legendaB}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: INK }} />{legendaLinha}</span>
      </figcaption>
    </figure>
  );
}

/** Linha simples (curva de peso, curva de lactação, cotação). */
export function Linha({ pontos, altura = 160, cor = LEAF, formatar = compacto, rotuloX, referencia, desdeZero = false }: {
  pontos: { x: string; y: number }[]; altura?: number; cor?: string; formatar?: (v: number) => string; rotuloX?: (x: string, i: number) => string;
  referencia?: { y: number; rotulo: string };
  /** Eixo a partir de zero: para volumes (litros, cabeças) não exagerar variações pequenas. */
  desdeZero?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (pontos.length === 0) return <p className="py-6 text-center text-[13px] italic text-muted">Sem dados para o gráfico.</p>;
  const W = 640;
  const H = altura;
  const pad = { l: 8, r: 8, t: 14, b: 24 };
  const ys = pontos.map((p) => p.y).concat(referencia ? [referencia.y] : [], desdeZero ? [0] : []);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const margem = (max - min) * 0.12 || 1;
  const y = escala(desdeZero ? 0 : min - margem, max + margem, H - pad.b, pad.t);
  const x = (i: number) => pad.l + (pontos.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (pontos.length - 1)) * (W - pad.l - pad.r));
  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de linha"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(ev) => {
          const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((ev.clientX - r.left) / r.width) * W;
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (pontos.length - 1));
          setHover(Math.max(0, Math.min(pontos.length - 1, i)));
        }}>
        {referencia ? (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(referencia.y)} y2={y(referencia.y)} stroke="#A4372A" strokeDasharray="4 4" />
            <text x={W - pad.r} y={y(referencia.y) - 4} textAnchor="end" fontSize="10.5" fill="#A4372A">{referencia.rotulo}</text>
          </g>
        ) : null}
        <path d={`${d} L${x(pontos.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`} fill={cor} opacity={0.08} />
        <path d={d} fill="none" stroke={cor} strokeWidth={2} />
        {pontos.map((p, i) => (i % passo === 0 || (i === pontos.length - 1 && i % passo >= passo / 2)) ? (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10.5" fill={MUTED}>{rotuloX ? rotuloX(p.x, i) : p.x}</text>
        ) : null)}
        {hover != null ? <circle cx={x(hover)} cy={y(pontos[hover].y)} r={4} fill={cor} /> : null}
      </svg>
      {hover != null ? (
        <div className="pointer-events-none absolute right-2 top-0 rounded-sm border border-rule bg-bone px-3 py-1.5 text-[12px] shadow-card">
          <span className="text-muted">{rotuloX ? rotuloX(pontos[hover].x, hover) : pontos[hover].x}: </span>
          <span className="num font-semibold">{formatar(pontos[hover].y)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Barras horizontais para rankings (custo por conta, frigoríficos, fornecedores). */
export function BarrasH({ itens, formatar = compacto, tom = 'earth' }: { itens: { rotulo: string; valor: number; extra?: string }[]; formatar?: (v: number) => string; tom?: 'earth' | 'leaf' }) {
  const max = Math.max(1, ...itens.map((i) => Math.abs(i.valor)));
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink">{i.rotulo}</span>
            <span className="num whitespace-nowrap text-ink">{formatar(i.valor)}{i.extra ? <span className="ml-2 text-muted">{i.extra}</span> : null}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-rule/40">
            <div className="h-full rounded-full" style={{ width: `${(Math.abs(i.valor) / max) * 100}%`, background: tom === 'leaf' ? LEAF : EARTH }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
