/**
 * Detalhes visuais do tema agropecuário: paisagem de pasto (morros, cerca,
 * cata-vento e gado), curvas de nível para fundos escuros e o brinco de
 * identificação. Tudo em SVG/CSS, sem imagem externa, para funcionar offline.
 */

import type { ReactNode } from 'react';

function Boi({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M2 4.2C2 2.4 3.4 1.6 5.2 1.6H14c1.9 0 3.2.5 4 1.6l2.6-.5c1 0 1.7.7 1.7 1.6v1.6c0 .8-.6 1.4-1.4 1.4h-2.1c-.5 1-1.4 1.6-2.6 1.7V13h-1.5V9.1H7.4V13H5.9V9.1C3.6 8.9 2 7.4 2 5.4Z" />
      <path d="M20.4 2.4l1.3-1.5M2.1 4.6C1 5.2.6 6.4.7 7.8" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );
}

/** Pasto ao entardecer, para painéis de fundo verde-escuro. */
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
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio={`xMaxYMax ${ajuste}`} className={className} aria-hidden>
      <circle cx="296" cy="62" r="40" fill={claro ? '#FFF3D0' : '#E9C46A'} opacity={claro ? 0.35 : 0.07} />
      <circle cx="296" cy="62" r="24" fill={claro ? '#F2C766' : '#E9C46A'} opacity={claro ? 0.85 : 0.22} />
      <path d="M0 104C54 82 104 88 158 100S262 76 330 90s54 6 70 2V160H0Z" fill={claro ? '#486B3A' : '#FFFFFF'} opacity={claro ? 0.28 : 0.05} />
      <path d="M0 120C70 100 128 124 204 110s110-10 196 4V160H0Z" fill="#486B3A" opacity={claro ? 0.85 : 0.5} />
      {/* cata-vento */}
      <g stroke={traco} strokeOpacity={claro ? 0.7 : 0.55} strokeWidth="1.1" strokeLinecap="round" fill="none">
        <path d="M96 68 88 116M96 68l8 48M90.5 100h11M92.3 88h7.4M90.5 100l9.2-12M101.500 100l-9.200-12" />
        <circle cx="96" cy="64" r="10" />
        <path d="M96 54v20M86 64h20M88.900 56.900l14.200 14.200M103.100 56.900 88.900 71.100M106 64l9-3v6Z" />
      </g>
      {/* árvore */}
      <g fill="#2F4A27">
        <rect x="343" y="92" width="3" height="20" rx="1" />
        <ellipse cx="344.500" cy="86" rx="15" ry="12" />
        <ellipse cx="334" cy="92" rx="9" ry="7" />
        <ellipse cx="356" cy="92" rx="9" ry="7" />
      </g>
      <g fill={gado} color={gado} opacity={claro ? 0.8 : 0.6}>
        <Boi x={176} y={99} s={0.9} />
        <Boi x={248} y={96} s={0.75} flip />
        <Boi x={212} y={103} s={0.62} />
      </g>
      <path d="M0 140C80 124 156 146 232 134s110-4 168 2V160H0Z" fill="#14200F" />
      {/* cerca de arame */}
      <g stroke={claro ? '#E9DFC8' : traco} strokeOpacity={claro ? 0.75 : 0.5} fill="none" strokeLinecap="round">
        <path d={arame(-9)} strokeWidth="0.7" />
        <path d={arame(-5)} strokeWidth="0.7" />
        {postes.map((x) => <path key={x} d={`M${x} ${(yCerca(x) - 13).toFixed(1)}V${(yCerca(x) + 4).toFixed(1)}`} strokeWidth="2" />)}
      </g>
    </svg>
  );
}

/** Curvas de nível (terraceamento do pasto), bem discretas, para o menu lateral. */
export function CurvasDeNivel({ className }: { className?: string }) {
  const linhas = Array.from({ length: 16 }, (_, i) => {
    const y = 40 + i * 62;
    const a = 26 + (i % 3) * 10;
    return `M-20 ${y}C40 ${y - a} 90 ${y + a} 150 ${y - a / 2}S240 ${y + a} 300 ${y - a}`;
  });
  return (
    <svg viewBox="0 0 280 1000" preserveAspectRatio="xMidYMin slice" className={className} aria-hidden>
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.045" strokeWidth="1.2">
        {linhas.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
}

/** Número do animal no formato do brinco de orelha amarelo. */
export function Brinco({ children, grande }: { children: ReactNode; grande?: boolean }) {
  return <span className={grande ? 'brinco brinco-lg' : 'brinco'}>{children}</span>;
}
