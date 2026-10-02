const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;

const radius = { sm: 12, md: 16, lg: 20, xl: 28, pill: 999 } as const;

const typography = {
  title: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
  sectionTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
} as const;

const targets = { ios: 44, android: 48, web: 44 } as const;

const elevation = { none: 0, low: 2, medium: 6 } as const;

export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly primaryPressed: string;
  readonly primarySubtle: string;
  readonly tabBarActive: string;
  readonly tabBarInactive: string;
  readonly backdrop: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly info: string;
  readonly onInfo: string;
  readonly success: string;
  readonly onSuccess: string;
  readonly warning: string;
  readonly onWarning: string;
  readonly danger: string;
  readonly onDanger: string;
  readonly dangerSubtle: string;
  readonly white: string;
}

export interface Theme {
  readonly colors: ThemeColors;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
  readonly targets: typeof targets;
  readonly elevation: typeof elevation;
}

const lightColors = {
  background: '#F4F1EC',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF8F5',
  primary: '#205B57',
  onPrimary: '#FFFFFF',
  primaryPressed: '#174541',
  primarySubtle: '#D9E9E6',
  tabBarActive: '#205B57',
  tabBarInactive: '#667085',
  backdrop: 'rgba(0,0,0,0.38)',
  text: '#182026',
  textMuted: '#626B78',
  border: '#E3E1DB',
  borderStrong: '#C9D6D2',
  info: '#155EEF',
  onInfo: '#FFFFFF',
  success: '#087443',
  onSuccess: '#FFFFFF',
  warning: '#9A6700',
  onWarning: '#FFFFFF',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  dangerSubtle: '#FDECEC',
  white: '#FFFFFF',
} as const satisfies ThemeColors;

const darkColors = {
  background: '#111918',
  surface: '#1A2523',
  surfaceMuted: '#222F2D',
  primary: '#71C7B8',
  onPrimary: '#12312D',
  primaryPressed: '#7EDCCF',
  primarySubtle: '#294640',
  tabBarActive: '#71C7B8',
  tabBarInactive: '#A4B4B0',
  backdrop: 'rgba(0,0,0,0.72)',
  text: '#F4F7F6',
  textMuted: '#B5C2BE',
  border: '#344541',
  borderStrong: '#49615C',
  info: '#85ADFF',
  onInfo: '#142342',
  success: '#68D09C',
  onSuccess: '#10291A',
  warning: '#FFCD70',
  onWarning: '#332407',
  danger: '#FF8E85',
  onDanger: '#340F0D',
  dangerSubtle: '#4A2422',
  white: '#FFFFFF',
} as const satisfies ThemeColors;

export const lightTheme = {
  colors: lightColors,
  spacing,
  radius,
  typography,
  targets,
  elevation,
} as const satisfies Theme;

export const darkTheme = {
  colors: darkColors,
  spacing,
  radius,
  typography,
  targets,
  elevation,
} as const satisfies Theme;

/** Compatibility alias for existing Claro-only consumers during migration. */
export const theme = lightTheme;
