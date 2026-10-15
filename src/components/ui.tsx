'use client';

/**
 * Componentes de interface no idioma visual do DRAP Fazenda: cartões "osso"
 * com borda fina, eyebrow em terra, títulos em Fraunces, números em mono.
 */

import { useEffect, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export function cx(...xs: (string | number | false | null | undefined)[]): string {
  return xs.filter((x) => typeof x === 'string' && x).join(' ');
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-2 font-display text-[34px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">{title}</h1>
        {sub ? <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** Destaque em itálico (folha ou terra), como em "O que <em>precisa da sua atenção</em> hoje". */
export function Em({ children, tom = 'leaf' }: { children: ReactNode; tom?: 'leaf' | 'earth' }) {
  return <span className={cx('italic', tom === 'leaf' ? 'text-leaf' : 'text-earth')}>{children}</span>;
}

export function Card({ eyebrow, title, icon, children, className, actions, pad = true, tone }: {
  eyebrow?: string; title?: ReactNode; icon?: ReactNode; children?: ReactNode; className?: string; actions?: ReactNode; pad?: boolean;
  tone?: 'leaf' | 'earth' | 'alert';
}) {
  const topo = tone === 'leaf' ? 'bg-leafLt/50' : tone === 'earth' ? 'bg-earthLt/50' : tone === 'alert' ? 'bg-alertLt/60' : '';
  return (
    <section className={cx('card rounded-sm', className)}>
      {(eyebrow || title || icon || actions) && (
        <div className={cx('flex items-start justify-between gap-3 px-5 pt-5 sm:px-6', topo, topo && 'pb-4 border-b border-earth/15', !pad && !topo && 'pb-4')}>
          <div className="min-w-0">
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-ink">{title}</h2> : null}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 text-earth">{actions}{icon}</div>
        </div>
      )}
      <div className={pad ? 'px-5 pb-5 pt-4 sm:px-6' : ''}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, size = 'md' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'leaf' | 'earth' | 'alert' | 'warn'; size?: 'md' | 'lg' }) {
  const cor = tone === 'leaf' ? 'text-leafDk' : tone === 'earth' ? 'text-earth' : tone === 'alert' ? 'text-alert' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow text-muted">{label}</span>
      <span className={cx('num font-medium leading-none', size === 'lg' ? 'text-3xl' : 'text-2xl', cor)}>{value}</span>
      {hint ? <span className="text-[12px] leading-snug text-muted">{hint}</span> : null}
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5' }[cols];
  return <div className={cx('card grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-rule/60', c)}>{
    Array.isArray(children)
      ? children.filter(Boolean).map((ch, i) => <div key={i} className="bg-bone p-5">{ch}</div>)
      : <div className="bg-bone p-5">{children}</div>
  }</div>;
}

export function Row({ label, value, tone, strong }: { label: ReactNode; value: ReactNode; tone?: 'leaf' | 'earth' | 'alert'; strong?: boolean }) {
  const cor = tone === 'leaf' ? 'text-leafDk' : tone === 'earth' ? 'text-earth' : tone === 'alert' ? 'text-alert' : 'text-ink';
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1.5 text-[13px] last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className={cx('num text-right', strong && 'font-semibold', cor)}>{value}</dd>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'leaf' | 'earth' | 'alert' | 'warn' | 'ink' }) {
  const s = {
    neutral: 'bg-[#EDE9DD] text-ink',
    leaf: 'bg-leafLt text-leafDk',
    earth: 'bg-earthLt text-earth',
    alert: 'bg-alertLt text-alert',
    warn: 'bg-warnLt text-warn',
    ink: 'bg-ink text-paper',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider', s)}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-[13px] italic text-muted">{children}</p>;
}

export function Field({ label, erro, children, className, dica }: { label: string; erro?: string; children: ReactNode; className?: string; dica?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="field-label">{label}</span>
      {children}
      {erro ? <span className="mt-1 block text-[12px] text-alert">{erro}</span> : dica ? <span className="mt-1 block text-[11.5px] text-muted">{dica}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('field-input', props.className)} />;
}

export function Select({ opcoes, vazio, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { opcoes: { value: string; label: string }[]; vazio?: string }) {
  return (
    <select {...props} className={cx('field-input', props.className)}>
      {vazio !== undefined ? <option value="">{vazio}</option> : null}
      {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={cx('field-input resize-y', props.className)} />;
}

export function Modal({ aberto, titulo, eyebrow, onFechar, children, largura = 'max-w-xl' }: {
  aberto: boolean; titulo: ReactNode; eyebrow?: string; onFechar: () => void; children: ReactNode; largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-4" onClick={onFechar} role="dialog" aria-modal="true">
      <div className={cx('card max-h-[92vh] w-full overflow-y-auto rounded-t-md sm:rounded-sm', largura)} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-rule/60 bg-bone px-5 py-4 sm:px-6">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2 className="mt-0.5 font-display text-2xl font-semibold text-ink">{titulo}</h2>
          </div>
          <button type="button" onClick={onFechar} className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-rule/40 hover:text-ink" aria-label="Fechar">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ abas, ativa, onChange }: { abas: { id: T; label: string; badge?: number }[]; ativa: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-rule" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id} type="button" role="tab" aria-selected={ativa === a.id} onClick={() => onChange(a.id)}
          className={cx('relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors', ativa === a.id ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {a.label}
          {a.badge ? <span className="num ml-1.5 rounded-full bg-earthLt px-1.5 text-[10px] text-earth">{a.badge}</span> : null}
          {ativa === a.id ? <span className="absolute inset-x-3 -bottom-px h-px bg-ink" aria-hidden /> : null}
        </button>
      ))}
    </div>
  );
}

/** Tabela rolável horizontalmente no celular, sem estourar a página. */
export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('-mx-5 overflow-x-auto sm:-mx-6', className)}>
      <table className="tabela min-w-full">{children}</table>
    </div>
  );
}

export function Aviso({ tone = 'earth', titulo, children }: { tone?: 'earth' | 'alert' | 'leaf' | 'warn'; titulo?: string; children: ReactNode }) {
  const s = {
    earth: 'border-earth/50 bg-earthLt/30',
    alert: 'border-alert/50 bg-alertLt/40',
    leaf: 'border-leaf/50 bg-leafLt/40',
    warn: 'border-warn/50 bg-warnLt/40',
  }[tone];
  const t = { earth: 'text-earth', alert: 'text-alert', leaf: 'text-leafDk', warn: 'text-warn' }[tone];
  return (
    <aside className={cx('rounded-sm border border-dashed px-5 py-4 text-[13px] leading-relaxed text-ink', s)}>
      {titulo ? <span className={cx('eyebrow', t)}>{titulo}</span> : null}
      <div className={titulo ? 'mt-1' : ''}>{children}</div>
    </aside>
  );
}

export function Barra({ valor, max = 1, tone = 'leaf' }: { valor: number; max?: number; tone?: 'leaf' | 'earth' | 'alert' | 'warn' }) {
  const pctv = Math.max(0, Math.min(100, (valor / (max || 1)) * 100));
  const c = { leaf: 'bg-leaf', earth: 'bg-earth', alert: 'bg-alert', warn: 'bg-warn' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-rule/40">
      <div className={cx('h-full rounded-full', c)} style={{ width: `${pctv}%` }} />
    </div>
  );
}
