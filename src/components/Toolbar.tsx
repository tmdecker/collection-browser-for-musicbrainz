/**
 * @ai-file component
 * @ai-description Floating pill toolbar with round icon buttons, used under the grid and in the album details panel
 * @ai-dependencies React
 * @ai-features
 * - Toolbar: solid pill one step lighter than the page (bg-background-control), no border or shadow
 * - ToolbarButton: icon only, always visible, with a tooltip above it on hover and keyboard focus;
 *   a link (href, new tab) or a button; spinning icon while busy, green when done, red when failed
 * - toolbarButtonClass: the same look for buttons made elsewhere (e.g. passed in as extraActions)
 * - Bigger buttons on touch screens
 * - align="end" for a toolbar at the right edge of its column: tooltips then open leftwards (context, so
 *   buttons made elsewhere with ToolbarTooltip follow it too)
 */

import React, { createContext, useContext } from 'react';

type ToolbarAlign = 'start' | 'end';

/** Which edge of its column the toolbar sits at; tooltips open away from it */
const ToolbarAlignContext = createContext<ToolbarAlign>('start');

export const Toolbar: React.FC<{ children: React.ReactNode; className?: string; label?: string; align?: ToolbarAlign }> = ({
  children,
  className = '',
  label,
  align = 'start',
}) => (
  <ToolbarAlignContext.Provider value={align}>
    <div
      role="toolbar"
      aria-label={label}
      className={`flex items-center gap-0.5 min-w-0 max-w-full rounded-full bg-background-control p-1 text-[13px] text-text-secondary whitespace-nowrap ${className}`}
    >
      {children}
    </div>
  </ToolbarAlignContext.Provider>
);

export const ToolbarDivider: React.FC = () => (
  <span className="mx-1 w-px h-4 bg-white/15 flex-shrink-0" aria-hidden="true" />
);

/** Round icon button look; colour comes from the caller (state) */
export const toolbarButtonClass =
  'group/tb relative grid place-items-center flex-shrink-0 w-8 h-8 [@media(hover:none)]:w-10 [@media(hover:none)]:h-10 rounded-full transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none disabled:cursor-default';

/**
 * Tooltip above a toolbar button, starting at the button's edge on the toolbar's side of its column (left-aligned
 * toolbar: left edge, opening rightwards; right-aligned: right edge, opening leftwards), so it is never cut off.
 * Shown on hover (mouse) and keyboard focus
 */
export const ToolbarTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const align = useContext(ToolbarAlignContext);
  return (
    <span
      role="presentation"
      className={`pointer-events-none absolute bottom-full ${align === 'end' ? 'right-0' : 'left-0'} mb-2 px-2 py-1 rounded-md bg-background-tertiary text-xs text-text-primary whitespace-nowrap opacity-0 transition-opacity
        [@media(hover:hover)]:group-hover/tb:opacity-100 group-focus-visible/tb:opacity-100 z-30`}
    >
      {children}
    </span>
  );
};

interface ToolbarButtonProps {
  icon: React.ReactNode;
  /** Tooltip and accessible name */
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  status?: 'busy' | 'done' | 'failed' | null;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, label, href, onClick, disabled = false, status = null }) => {
  const colour = status === 'failed' ? 'text-red-400' : status === 'done' ? 'text-green-400' : 'text-text-secondary hover:text-text-primary';
  const content = (
    <>
      <span className={`grid place-items-center text-[18px] [@media(hover:none)]:text-[20px] ${status === 'busy' ? 'animate-spin motion-reduce:animate-none' : ''}`}>{icon}</span>
      <ToolbarTooltip>{label}</ToolbarTooltip>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={`${toolbarButtonClass} ${colour}`}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${toolbarButtonClass} ${colour}`}
    >
      {content}
    </button>
  );
};
