import { theme } from './tokens';

export const AUTH_THEME = {
  ...theme,
  colors: {
    ...theme.colors,
    surfaceSoft: theme.colors.surfaceMuted,
    primaryDark: theme.colors.primaryPressed,
    primarySoft: theme.colors.primarySubtle,
    primaryBorder: theme.colors.borderStrong,
    muted: theme.colors.textMuted,
    error: theme.colors.danger,
    errorSoft: theme.colors.dangerSubtle,
  },
  typography: {
    title: theme.typography.title.fontSize,
    sectionTitle: theme.typography.sectionTitle.fontSize,
    body: theme.typography.body.fontSize,
    label: theme.typography.label.fontSize,
    caption: theme.typography.caption.fontSize,
  },
} as const;
