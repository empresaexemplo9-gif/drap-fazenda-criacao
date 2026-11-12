'use client';

/**
 * Detalhes visuais do tema agropecuário: paisagem de pasto (morros, cerca,
 * cata-vento, árvore, gado, nuvens e pássaros), curvas de nível para fundos
 * escuros, divisor em forma de cerca com um bem-te-vi e o brinco de
 * identificação. Tudo em SVG/CSS, sem imagem externa, para funcionar offline.
 * As animações ficam em globals.css (classes "anim-*") e param quando o
 * aparelho pede movimento reduzido.
 */

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Liga as animações só quando o elemento entra na tela. */
function useEmVista<T extends Element>(): [(el: T | null) => void, boolean] {
  const [vis, setVis] = useState(false);
  const io = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    io.current?.disconnect();
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVis(true); return; }
    io.current = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); io.current?.disconnect(); }
    }, { threshold: 0.25 });
    io.current.observe(el);
  }, []);
  return [ref, vis];
}

const giro = (x: number, y: number): CSSProperties => ({ transformBox: 'view-box', transformOrigin: `${x}px ${y}px` });

function Boi({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M2 4.2C2 2.4 3.4 1.6 5.2 1.6H14c1.9 0 3.2.5 4 1.6l2.6-.5c1 0 1.7.7 1.7 1.6v1.6c0 .8-.6 1.4-1.4 1.4h-2.1c-.5 1-1.4 1.6-2.6 1.7V13h-1.5V9.1H7.4V13H5.9V9.1C3.6 8.9 2 7.4 2 5.4Z" />
      <path d="M20.4 2.4l1.3-1.5M2.1 4.6C1 5.2.6 6.4.7 7.8" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );
}

function Nuvem({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="15" ry="4.5" />
      <ellipse cx="5" cy="-3.5" rx="8" ry="5" />
      <ellipse cx="-5" cy="-2" rx="6" ry="3.6" />
    </g>
  );
}

/** Tufo de capim: três folhas a partir da base (0,0). */
function Capim({ x, y, atraso }: { x: number; y: number; atraso: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="anim-capim" style={{ animationDelay: `${atraso}s` }}
        d="M0 0C-.6-3-2.2-5-4.4-6.4M0 0C0-3.4.8-6.2 1.2-8.6M0 0C.9-2.6 2.6-4.4 4.8-5.2" />
    </g>
  );
}

/** Pasto ao entardecer, para painéis de fundo verde-escuro (ou do degradê claro). */
export function Paisagem({ className, ajuste = 'slice', ceu = 'escuro' }: {
  className?: string; ajuste?: 'slice' | 'meet';
  /** 'claro' quando o fundo atrás da paisagem é o marrom claro do degradê. */
  ceu?: 'escuro' | 'claro';
}) {
  const claro = ceu === 'claro';
  const traco = claro ? '#1F3019' : '#DCE8D2';
  const gado = claro ? '#1F3019' : '#EAF1E3';
  const postes = [12, 44, 76, 108, 140, 172, 204, 236, 268, 300, 332, 364, 396];
  const yCerca = (x: number) => 137 + Math.sin(x / 46) * 3.2;
  const arame = (dy: number) => postes.map((x, i) => `${i ? 'L' : 'M'}${x} ${(yCerca(x) + dy).toFixed(1)}`).join(' ');
  const pas = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    return `M96 64L${(96 + Math.cos(a) * 10).toFixed(2)} ${(64 + Math.sin(a) * 10).toFixed(2)}`;
  }).join('');
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio={`xMaxYMax ${ajuste}`} className={className} aria-hidden>
      {/* sol com halo respirando */}
      <circle className="anim-sol" style={giro(296, 62)} cx="296" cy="62" r="40" fill={claro ? '#FFF3D0' : '#E9C46A'} opacity={claro ? 0.35 : 0.07} />
      <circle cx="296" cy="62" r="24" fill={claro ? '#F2C766' : '#E9C46A'} opacity={claro ? 0.85 : 0.22} />

      {/* nuvens atravessando o céu */}
      <g fill="#FFFFFF" opacity={claro ? 0.55 : 0.08}>
        <g className="anim-nuvem"><Nuvem x={-40} y={30} /></g>
        <g className="anim-nuvem anim-nuvem-lenta" style={{ animationDelay: '-38s' }}><Nuvem x={-40} y={46} s={0.75} /></g>
      </g>

      {/* revoada voltando para o pouso */}
      <g className="anim-revoada" fill="none" stroke={traco} strokeOpacity={claro ? 0.6 : 0.5} strokeWidth="0.9" strokeLinecap="round">
        <path className="anim-asa" d="M0 0q2.5-2.5 5 0q2.5-2.5 5 0" transform="translate(0 0)" />
        <path className="anim-asa" style={{ animationDelay: '-.2s' }} d="M0 0q2-2 4 0q2-2 4 0" transform="translate(12 -5)" />
        <path className="anim-asa" style={{ animationDelay: '-.35s' }} d="M0 0q2-2 4 0q2-2 4 0" transform="translate(-9 6)" />
      </g>

      <path d="M0 104C54 82 104 88 158 100S262 76 330 90s54 6 70 2V160H0Z" fill={claro ? '#486B3A' : '#FFFFFF'} opacity={claro ? 0.28 : 0.05} />
      <path d="M0 120C70 100 128 124 204 110s110-10 196 4V160H0Z" fill="#486B3A" opacity={claro ? 0.85 : 0.5} />

      {/* cata-vento: torre fixa, roda girando com o vento */}
      <g stroke={traco} strokeOpacity={claro ? 0.7 : 0.55} strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path d="M96 68 88 116M96 68l8 48M90.5 100h11M92.3 88h7.4M90.5 100l9.2-12M101.5 100l-9.2-12" />
        <path d="M96 64h10M106 64l9-3v6Z" />
        <g className="anim-rotor" style={giro(96, 64)}>
          <circle cx="96" cy="64" r="10" />
          <path d={pas} />
        </g>
        <circle cx="96" cy="64" r="1.4" fill={traco} />
      </g>

      {/* árvore balançando de leve */}
      <g className="anim-arvore" style={giro(344.5, 112)} fill="#2F4A27">
        <rect x="343" y="92" width="3" height="20" rx="1" />
        <ellipse cx="344.5" cy="86" rx="15" ry="12" />
        <ellipse cx="334" cy="92" rx="9" ry="7" />
        <ellipse cx="356" cy="92" rx="9" ry="7" />
      </g>

      {/* gado pastando: abaixa a cabeça e anda devagar */}
      <g fill={gado} color={gado} opacity={claro ? 0.8 : 0.6}>
        <g className="anim-andar"><g className="anim-pastar"><Boi x={176} y={99} s={0.9} /></g></g>
        <g className="anim-pastar-esq" style={{ animationDelay: '-2.6s' }}><Boi x={248} y={96} s={0.75} flip /></g>
        <g className="anim-pastar" style={{ animationDelay: '-4.1s' }}><Boi x={212} y={103} s={0.62} /></g>
      </g>

      <path d="M0 140C80 124 156 146 232 134s110-4 168 2V160H0Z" fill="#14200F" />

      {/* capim na beira do morro */}
      <g fill="none" stroke="#14200F" strokeWidth="1.3" strokeLinecap="round">
        {[[22, 136.5, 0], [64, 133.5, -1.1], [128, 137, -0.4], [186, 138, -1.7], [262, 131, -0.8], [318, 129.5, -2.1], [378, 133.5, -1.4]].map(([x, y, d]) => (
          <Capim key={x} x={x} y={y} atraso={d} />
        ))}
      </g>

      {/* cerca de arame: mourões fincados um a um e o arame esticado em seguida */}
      <g stroke={claro ? '#E9DFC8' : traco} strokeOpacity={claro ? 0.75 : 0.5} fill="none" strokeLinecap="round">
        <path className="anim-arame" pathLength={1} d={arame(-9)} strokeWidth="0.7" />
        <path className="anim-arame" pathLength={1} style={{ animationDelay: '1.05s' }} d={arame(-5)} strokeWidth="0.7" />
        {postes.map((x, i) => (
          <path key={x} className="anim-mourao" style={{ animationDelay: `${0.1 + i * 0.07}s` }}
            d={`M${x} ${(yCerca(x) - 13).toFixed(1)}V${(yCerca(x) + 4).toFixed(1)}`} strokeWidth="2" />
        ))}
      </g>
    </svg>
  );
}

/** Curvas de nível (terraceamento do pasto), bem discretas, para o menu lateral. */
export function CurvasDeNivel({ className }: { className?: string }) {
  const linhas = Array.from({ length: 16 }, (_, i) => {
    const y = 40 + i * 62;
    const a = 26 + (i % 3) * 10;
    return `M-40 ${y}C20 ${y - a} 70 ${y + a} 130 ${y - a / 2}S220 ${y + a} 280 ${y - a}S360 ${y + a} 400 ${y - a / 2}`;
  });
  return (
    <svg viewBox="0 0 280 1000" preserveAspectRatio="xMidYMin slice" className={className} aria-hidden>
      <g className="anim-curvas" fill="none" stroke="#FFFFFF" strokeOpacity="0.045" strokeWidth="1.2">
        {linhas.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}

/** Bem-te-vi: dorso marrom, peito amarelo e a listra branca na cabeça. */
function BemTeVi() {
  return (
    <svg viewBox="0 0 15 12" width="19" height="15.2">
      <path d="M3.4 5.4 0.4 3.6l.5 2.1 2.3 1.2Z" fill="#5C4528" />
      <ellipse cx="7" cy="6.2" rx="4.1" ry="2.8" fill="#6B5233" />
      <path d="M5.2 7.6c1.6 1.4 4.6 1.2 5.6-.8-.6-1.6-2.4-2-3.8-1.6-1.2.4-2 1.2-1.8 2.4Z" fill="#F2C94C" />
      <circle cx="10.6" cy="4" r="2.1" fill="#2B231A" />
      <path d="M9.1 3.5c.9-.5 2.2-.5 3.1 0" stroke="#FFFFFF" strokeWidth=".7" strokeLinecap="round" fill="none" />
      <path d="M12.5 3.8 14.6 4.3 12.5 4.9Z" fill="#2B231A" />
      <path d="M6.6 8.6v2.8M8.2 8.6v2.8" stroke="#3A2E1C" strokeWidth=".7" strokeLinecap="round" />
    </svg>
  );
}

/** Divisor de seção: a cerca se estende quando aparece na tela e um bem-te-vi pousa no arame. */
export function Cerca({ className, atraso = 0 }: { className?: string; atraso?: number }) {
  const [ref, vis] = useEmVista<HTMLSpanElement>();
  return (
    <span ref={ref} aria-hidden style={{ '--atraso': `${atraso}s` } as CSSProperties}
      className={['cerca-anim relative block h-3', vis ? 'em-vista' : '', className].filter(Boolean).join(' ')}>
      <span className="cerca block h-full" />
      <span className="passarinho"><BemTeVi /></span>
    </span>
  );
}

/** Número do animal no formato do brinco de orelha amarelo. */
export function Brinco({ children, grande }: { children: ReactNode; grande?: boolean }) {
  return <span className={grande ? 'brinco brinco-lg' : 'brinco'}>{children}</span>;
}
