import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { STATUS_PRESENTATION, type NormelyaStatus } from '@normelya/core'

/**
 * Design system Normelya.
 *
 * Composants volontairement peu nombreux et sans dépendance externe : chaque
 * élément est un bloc lisible, clair et calme. Rien n'est repris d'une autre
 * solution du marché.
 */

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/* ------------------------------------------------------------------ Boutons */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  full?: boolean
}

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[var(--color-normelya-600)] text-white hover:bg-[var(--color-normelya-700)] shadow-sm',
  secondary:
    'bg-white text-[var(--color-ink-900)] border border-[var(--color-ink-100)] hover:bg-[var(--color-surface-sunken)]',
  ghost: 'text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]',
  danger: 'bg-[var(--color-status-danger)] text-white hover:brightness-95',
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-11 px-5 text-sm' : 'h-9 px-3.5 text-sm',
        full && 'w-full',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  )
}

/* -------------------------------------------------------------------- Cartes */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag
      className={cx(
        'rounded-[var(--radius-card)] border border-[var(--color-ink-100)] bg-white',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, action }: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-ink-100)] px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-ink-900)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-5 py-4', className)}>{children}</div>
}

/** Carte de mesure du tableau de bord. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  hint?: string
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const tones = {
    neutral: 'text-[var(--color-ink-900)]',
    warning: 'text-[var(--color-status-warning)]',
    danger: 'text-[var(--color-status-danger)]',
  }
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--color-ink-500)]">{label}</p>
      <p className={cx('mt-2 text-3xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-ink-300)]">{hint}</p> : null}
    </Card>
  )
}

/* -------------------------------------------------------------------- Badges */

/**
 * Badge de statut.
 *
 * Les libellés proviennent de packages/core, où le vocabulaire interdit par
 * CLAUDE.md est proscrit. Aucun composant ne peut l'introduire.
 */
export function StatusBadge({ status }: { status: NormelyaStatus }) {
  const presentation = STATUS_PRESENTATION[status]
  const tones: Record<typeof presentation.tone, string> = {
    success: 'bg-[var(--color-normelya-50)] text-[var(--color-status-success)]',
    warning: 'bg-[var(--color-amber-brand-50)] text-[var(--color-status-warning)]',
    danger: 'bg-red-50 text-[var(--color-status-danger)]',
    neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-status-neutral)]',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[presentation.tone],
      )}
    >
      <span aria-hidden>{presentation.symbol}</span>
      {presentation.label}
    </span>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'demo'
}) {
  const tones = {
    neutral: 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)]',
    brand: 'bg-[var(--color-normelya-50)] text-[var(--color-normelya-700)]',
    demo: 'bg-[var(--color-amber-brand-100)] text-[var(--color-amber-brand-700)]',
  }
  return (
    <span className={cx('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

/* ----------------------------------------------------------------- Messages */

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title?: string
  children: ReactNode
}) {
  const tones = {
    info: 'border-[var(--color-ink-100)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-700)]',
    warning:
      'border-[var(--color-amber-brand-300)] bg-[var(--color-amber-brand-50)] text-[var(--color-amber-brand-700)]',
    danger: 'border-red-200 bg-red-50 text-[var(--color-status-danger)]',
    success:
      'border-[var(--color-normelya-200)] bg-[var(--color-normelya-50)] text-[var(--color-normelya-700)]',
  }
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('rounded-[var(--radius-control)] border px-4 py-3 text-sm', tones[tone])}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}

/* --------------------------------------------------------------- Formulaires */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[var(--color-ink-700)]">
        {label}
        {/*
          L'astérisque est décoratif : il fait doublon avec l'attribut required,
          déjà annoncé par les lecteurs d'écran. Sans aria-hidden, il entrerait
          dans le nom accessible du champ, qui deviendrait « Nom * ».
        */}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--color-status-danger)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-[var(--color-ink-300)]">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-[var(--color-status-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const CONTROL_CLASSES =
  'w-full rounded-[var(--radius-control)] border border-[var(--color-ink-100)] bg-white px-3.5 ' +
  'text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-300)] ' +
  'focus:border-[var(--color-normelya-400)] focus:outline-none'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL_CLASSES, 'h-11', className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(CONTROL_CLASSES, 'h-11', className)}>
      {children}
    </select>
  )
}

/* ------------------------------------------------------------------ États vides */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-ink-100)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-500)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* --------------------------------------------------------------------- Logo */

/**
 * Logo Normelya : marque typographique accompagnée d'un symbole.
 * Le symbole évoque une flamme inscrite dans un contour de contrôle — la
 * fabrication et la vérification réunies.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = { sm: 20, md: 26, lg: 34 }[size]
  const texte = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size]
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={dimensions}
        height={dimensions}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        role="presentation"
      >
        <rect
          x="1.25"
          y="1.25"
          width="29.5"
          height="29.5"
          rx="9"
          stroke="var(--color-normelya-600)"
          strokeWidth="2.5"
        />
        <path
          d="M16 8c2.9 3.2 4.6 5.7 4.6 8.3A4.6 4.6 0 0 1 16 21a4.6 4.6 0 0 1-4.6-4.7c0-2.6 1.7-5.1 4.6-8.3Z"
          fill="var(--color-normelya-600)"
        />
        <path
          d="M11.5 24.5h9"
          stroke="var(--color-amber-brand-500)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className={cx('font-semibold tracking-tight text-[var(--color-ink-900)]', texte)}>
        Normelya
      </span>
    </span>
  )
}
