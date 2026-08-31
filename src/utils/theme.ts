export interface ThemeSettings {
  primaryGreen: string;
  accentGold: string;
  bgCream: string;
}

export const DEFAULT_THEME: ThemeSettings = {
  primaryGreen: '#1A3C2E',
  accentGold: '#F5B400',
  bgCream: '#FAF7EA',
};

const THEME_PRESETS: { name: string; colors: ThemeSettings }[] = [
  {
    name: 'Default CCIS SC',
    colors: DEFAULT_THEME,
  },
  {
    name: 'Cyber Tiger Tech',
    colors: {
      primaryGreen: '#0F172A',
      accentGold: '#38BDF8',
      bgCream: '#F8FAFC',
    },
  },
  {
    name: 'Sportsfest Tiger Blood',
    colors: {
      primaryGreen: '#7F1D1D',
      accentGold: '#F5B400',
      bgCream: '#FFFBEB',
    },
  },
  {
    name: 'CCIS Innovate Hackathon',
    colors: {
      primaryGreen: '#3B0764',
      accentGold: '#22C55E',
      bgCream: '#F5F3FF',
    },
  },
  {
    name: 'Retro Terminal',
    colors: {
      primaryGreen: '#090D16',
      accentGold: '#39FF14',
      bgCream: '#121824',
    },
  },
];

export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '';
};

export const lightenColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
};

export const applyTheme = (theme: ThemeSettings) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--color-primary-green', theme.primaryGreen);
  root.style.setProperty('--color-primary-green-rgb', hexToRgb(theme.primaryGreen));

  root.style.setProperty('--color-accent-gold', theme.accentGold);
  root.style.setProperty('--color-accent-gold-rgb', hexToRgb(theme.accentGold));

  const hoverGold = lightenColor(theme.accentGold, 10);
  root.style.setProperty('--color-accent-gold-hover', hoverGold);

  root.style.setProperty('--color-bg-cream', theme.bgCream);
  root.style.setProperty('--color-bg-cream-rgb', hexToRgb(theme.bgCream));
};
