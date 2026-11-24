'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { blendHex, withAlpha } from './templates/certificate-frame';
import { getClientTemplate } from './templates/template-registry';

/**
 * A miniature swatch of a template — not a full `CertificateDocument`.
 *
 * The admin dialogs show all five at once, and five real documents at 1056×816
 * would rasterise five full layouts every time a dialog opens. The miniature
 * carries the same palette and motif (border, gradient band, grid, seal) so
 * the choice is recognisable at a glance.
 */
export function CertificateTemplatePreview({
  template,
  selected = false,
  onSelect,
  compact = false,
  className,
}) {
  const registryTemplate = getClientTemplate(template?.key);
  const palette = { ...registryTemplate, ...template };
  const accent = palette.accent;
  const ink = palette.ink;
  const paper = palette.paper;
  const accentSoft = palette.accentSoft;
  const isTech = palette.key === 'tech';
  const isVibrant = palette.key === 'vibrant';
  const isElegant = palette.key === 'elegant';
  const isClassic = palette.key === 'classic';
  const isPlatinum = palette.key === 'platinum';
  const isPlatinumParticipation = palette.key === 'platinum-participation';
  const isPlatinumAchievement = palette.key === 'platinum-achievement';

  const bar = (width, height, color, extra = {}) => (
    <span
      style={{
        display: 'block',
        width,
        height,
        background: color,
        borderRadius: 2,
        ...extra,
      }}
    />
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={palette.label}
      className={cn(
        'group relative overflow-hidden rounded-lg border-2 bg-card text-left transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/25'
          : 'border-border hover:border-primary/40',
        className
      )}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1056 / 816',
          background: paper,
          overflow: 'hidden',
        }}
      >
        {isVibrant ? (
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '42%',
              background:
                'linear-gradient(118deg, #BE185D 0%, #DB2777 46%, #F97316 100%)',
            }}
          />
        ) : null}

        {isTech
          ? Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`v-${index}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${16 * (index + 1)}%`,
                  width: 1,
                  background: withAlpha(accent, 0.18),
                }}
              />
            ))
          : null}
        {isTech
          ? Array.from({ length: 3 }).map((_, index) => (
              <span
                key={`h-${index}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${24 * (index + 1)}%`,
                  height: 1,
                  background: withAlpha(accent, 0.18),
                }}
              />
            ))
          : null}

        {!isVibrant ? (
          <span
            style={{
              position: 'absolute',
              inset: '9%',
              border: `${isClassic ? 2 : 1}px solid ${accent}`,
              borderRadius: isElegant ? 0 : 3,
            }}
          />
        ) : null}

        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            padding: '0 12%',
          }}
        >
          {bar('52%', 6, isVibrant ? '#FFFFFF' : accent)}
          {bar('34%', 3, blendHex(ink, paper, 0.35))}
          <span style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            {bar('26%', 3, blendHex(ink, paper, 0.6))}
            {bar('26%', 3, blendHex(ink, paper, 0.75))}
          </span>
        </span>

        {isElegant ? (
          <span
            style={{
              position: 'absolute',
              right: '8%',
              bottom: '12%',
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `1.5px solid ${accent}`,
              background: accentSoft,
            }}
          />
        ) : null}

        {isPlatinum ? (
          <>
            {/* Top-right award ribbon swatch */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                right: '10%',
                width: 14,
                height: 26,
                background: '#0B1B3D',
                border: '1px solid #C5A059',
                borderTop: 'none',
              }}
            />
            {/* Top-left wave swatch */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 22,
                height: 22,
                borderBottomRightRadius: '100%',
                background: '#0B1B3D',
                borderRight: '1.5px solid #C5A059',
                borderBottom: '1.5px solid #C5A059',
              }}
            />
            {/* Bottom-right wave swatch */}
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 22,
                height: 22,
                borderTopLeftRadius: '100%',
                background: '#0B1B3D',
                borderLeft: '1.5px solid #C5A059',
                borderTop: '1.5px solid #C5A059',
              }}
            />
          </>
        ) : null}

        {isPlatinumParticipation ? (
          <>
            {/* Left curved wave */}
            <span
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '18%',
                background: '#0B1B3D',
                borderRight: '1.5px solid #C5A059',
              }}
            />
            {/* Top-right QR swatch */}
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 10,
                height: 10,
                border: '1px solid #0B1B3D',
                background: '#FFFFFF',
              }}
            />
          </>
        ) : null}

        {isPlatinumAchievement ? (
          <>
            {/* Double border */}
            <span
              style={{
                position: 'absolute',
                inset: 3,
                border: '1px solid #C5A059',
              }}
            />
            {/* Center Medal Badge swatch */}
            <span
              style={{
                position: 'absolute',
                top: '52%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '1.5px solid #C5A059',
                background: '#0B1B3D',
              }}
            />
            {/* Top-right QR swatch */}
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 10,
                height: 10,
                border: '1px solid #0B1B3D',
                background: '#FFFFFF',
              }}
            />
          </>
        ) : null}

        {isVibrant ? (
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              background:
                'linear-gradient(118deg, #BE185D 0%, #DB2777 46%, #F97316 100%)',
            }}
          />
        ) : null}
      </div>

      <div className={cn('px-2.5 py-2', compact && 'py-1.5')}>
        <p className="text-xs font-semibold leading-tight text-foreground">
          {palette.label}
        </p>
        {!compact ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {palette.description}
          </p>
        ) : null}
      </div>

      {selected ? (
        <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
}

export function CertificateTemplatePicker({
  value,
  onChange,
  templates,
  compact = false,
  className,
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        className
      )}
    >
      {templates.map((template) => (
        <CertificateTemplatePreview
          key={template.key}
          template={template}
          compact={compact}
          selected={value === template.key}
          onSelect={() => onChange?.(template.key)}
        />
      ))}
    </div>
  );
}
