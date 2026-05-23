// ─── Tokaroo Design Tokens ────────────────────────────────────────────────────
// Single source of truth for all visual design decisions.
// Aesthetic direction: "Surgical Darkness" — black, white, muted purple, subtle red.

export const COLORS = {
  // Base
  black:      '#000000',
  darkBg:     '#0a0a0a',
  darkCard:   '#111111',
  darkElevated:'#161616',

  // Borders
  border:     'rgba(255, 255, 255, 0.06)',
  borderMid:  'rgba(255, 255, 255, 0.08)',
  borderHi:   'rgba(255, 255, 255, 0.12)',

  // Text
  textPrimary:   '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted:     '#52525b',
  textDim:       '#3f3f46',

  // Accents
  accentPurple:  '#a855f7',
  accentPurpleMuted: '#8b5cf6',
  accentRed:     '#ef4444',
  accentBlue:    '#3b82f6',

  // Glows
  glowPurple:  'rgba(168, 85, 247, 0.4)',
  glowPurpleSoft: 'rgba(168, 85, 247, 0.15)',
  glowRed:     'rgba(239, 68, 68, 0.3)',
  glowRedSoft: 'rgba(239, 68, 68, 0.12)',
} as const;

export const TYPOGRAPHY = {
  // Font stacks
  sans: "'Inter', 'Segoe UI', system-ui, sans-serif",
  display: "'Inter', system-ui, sans-serif", // Swap for Clash Display / Satoshi when loaded

  // Hero scale
  h1:   'clamp(3.2rem, 6.5vw, 6rem)',
  h1Sub:'clamp(3.4rem, 6.8vw, 6.4rem)',
  h2:   'clamp(2rem, 3.5vw, 3rem)',
  h3:   'clamp(1.6rem, 2.5vw, 2.2rem)',
  body: '1.05rem',
  bodyLg: '1.15rem',
  caption: '11px',

  // Weights
  weightBold:   700,
  weightSemi:   600,
  weightNormal: 400,

  // Letter spacing
  trackingTight: '-0.03em',
  trackingWide:  '0.1em',
  trackingXWide: '0.12em',
} as const;

export const SPACING = {
  navHeight: 70,
  sectionPad: '10rem 3.5rem',
  sectionPadSm: '7rem 2rem',
  maxContent: '1200px',
  maxText: '1100px',
} as const;

export const MOTION = {
  // Core easing — "Expo Out" for elegance
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',

  // Durations
  micro:  0.25,  // button hovers, micro-interactions
  quick:  0.4,   // card reveals
  normal: 0.7,   // section entrances
  slow:   1.2,   // major transitions

  // GSAP stagger
  stagger: 0.08,

  // Breathing (sine wave)
  breathPeriod: 4000, // ms — 4s cycle
  breathScale:  [0.97, 1.03] as [number, number],
} as const;

export const SHADOWS = {
  nodeGlow:    `0 0 20px ${COLORS.glowPurple}, 0 0 40px ${COLORS.glowPurple}`,
  cardHover:   `0 8px 32px rgba(0,0,0,0.4), inset 0 0 24px ${COLORS.glowPurpleSoft}`,
  failureGlow: `0 0 30px ${COLORS.glowRed}, 0 0 60px ${COLORS.glowRed}`,
  ctaButton:   '0 0 32px rgba(168,85,247,0.25), 0 8px 24px rgba(0,0,0,0.4)',
} as const;

export const RADII = {
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '20px',
  full: '999px',
} as const;
