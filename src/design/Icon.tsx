import { useId } from 'react';
import { fallbackGlyph, glyphs, isSymbolName } from './icons.ts';
import type { Glyph } from './icons.ts';

interface IconProps {
  /** An SF Symbol name, e.g. "cart.fill". Unknown names render a neutral fallback glyph. */
  name: string;
  /** Rendered size in px; iOS symbols follow the font size, so match it to the text next to the icon. */
  size?: number;
  /** Accessible name. Without one the icon is decorative and hidden from assistive technology. */
  label?: string;
  className?: string;
}

const strokeWidth = 2;
const cutWidth = 1.8;

/** An SF Symbol drawn as inline SVG in `currentColor`, so it takes the text colour of its parent. */
export function Icon({ name, size = 20, label, className }: IconProps) {
  const maskId = useId();
  const glyph: Glyph = isSymbolName(name) ? glyphs[name] : fallbackGlyph;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {glyph.cut && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth={cutWidth} strokeLinecap="round" strokeLinejoin="round">
            {glyph.cut.map((path) => (
              <path key={path} d={path} />
            ))}
          </g>
        </mask>
      )}
      {glyph.fill && (
        <g fill="currentColor" fillRule="evenodd" mask={glyph.cut ? `url(#${maskId})` : undefined}>
          {glyph.fill.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
      )}
      {glyph.stroke && (
        <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
          {glyph.stroke.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
      )}
      {glyph.dotted && (
        <g fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="0.01 3.2">
          {glyph.dotted.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
      )}
    </svg>
  );
}
