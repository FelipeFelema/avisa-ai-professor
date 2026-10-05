import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenState, ThemeSelector } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

import type { Theme } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const { palette } = useTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const styles = createStyles(palette);

  const handleLogout = async () => {
    setIsSigningOut(true);

    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return <ScreenState kind="loading" title="Carregando perfil" message="Aguarde um momento." />;
  }

  if (!user) {
    return (
      <ScreenState
        kind="not-found"
        title="Perfil não disponível"
        message="Entre novamente para consultar seus dados."
        actionLabel="Entrar"
        onAction={() => router.replace('/login')}
      />
    );
  }

  return (
    <SafeAreaView testID="profile-screen" style={styles.safeArea}>
      <ScrollView
        testID="profile-scroll-view"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Meu perfil
            </Text>
            <Text style={styles.subtitle}>
              Confira suas informações de conta e saia quando precisar.
            </Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons
                accessibilityElementsHidden
                importantForAccessibility="no"
                name="person-outline"
                size={18}
                color={palette.colors.primary}
              />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoLabel}>Nome</Text>
              <Text style={styles.infoValue}>{user.name}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons
                accessibilityElementsHidden
                importantForAccessibility="no"
                name="mail-outline"
                size={18}
                color={palette.colors.primary}
              />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoLabel}>E-mail</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons
                accessibilityElementsHidden
                importantForAccessibility="no"
                name="shield-checkmark-outline"
                size={18}
                color={palette.colors.primary}
              />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoLabel}>Perfil</Text>
              <Text style={styles.infoValue}>{user.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.appearanceCard}>
          <View style={styles.appearanceHeader}>
            <Text accessibilityRole="header" style={styles.appearanceTitle}>
              Aparência
            </Text>
          </View>
          <ThemeSelector />
        </View>

        <Button
          label="Editar perfil"
          variant="secondary"
          onPress={() => router.push('/profile/edit')}
        />

        <Button
          label="Alterar senha"
          variant="secondary"
          onPress={() => router.push('/profile/change-password')}
        />

        {user.role === 'ADMIN' ? (
          <Button
            label="Convites de professores"
            variant="secondary"
            onPress={() => router.push('/admin/teacher-invites')}
          />
        ) : null}

        <Button
          label="Sair da conta"
          variant="destructive"
          loading={isSigningOut}
          onPress={handleLogout}
        />

        <Button
          label="Excluir minha conta"
          variant="destructive"
          accessibilityHint="Abrir o resumo e a confirmação da exclusão permanente da sua conta"
          onPress={() => router.push('/profile/delete-account')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(palette: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.colors.background,
    },

    content: {
      flexGrow: 1,
      padding: palette.spacing.xl,
      gap: palette.spacing.xl,
    },

    headerCard: {
      backgroundColor: palette.colors.surface,
      borderRadius: palette.radius.xl,
      padding: palette.spacing.xl,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: palette.spacing.lg,
    },

    avatar: {
      width: 72,
      height: 72,
      borderRadius: palette.radius.pill,
      backgroundColor: palette.colors.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarText: {
      color: palette.colors.primaryPressed,
      fontSize: 28,
      fontWeight: '800',
    },

    headerCopy: {
      gap: palette.spacing.xs,
    },

    title: {
      fontSize: palette.typography.title.fontSize,
      fontWeight: '800',
      color: palette.colors.text,
    },

    subtitle: {
      color: palette.colors.textMuted,
      fontSize: palette.typography.body.fontSize,
      lineHeight: palette.typography.body.lineHeight,
    },

    infoCard: {
      backgroundColor: palette.colors.surface,
      borderRadius: palette.radius.xl,
      padding: palette.spacing.xl,
      borderWidth: 1,
      borderColor: palette.colors.border,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: palette.spacing.md,
    },

    infoIconWrap: {
      flexShrink: 0,
      width: 40,
      height: 40,
      borderRadius: palette.radius.pill,
      backgroundColor: palette.colors.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoTextBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },

    infoLabel: {
      color: palette.colors.textMuted,
      fontSize: palette.typography.caption.fontSize,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    infoValue: {
      color: palette.colors.text,
      fontSize: palette.typography.body.fontSize,
      fontWeight: '700',
      flexShrink: 1,
      lineHeight: palette.typography.body.lineHeight,
    },

    separator: {
      height: 1,
      backgroundColor: palette.colors.border,
      marginVertical: palette.spacing.lg,
    },

    appearanceCard: {
      backgroundColor: palette.colors.surface,
      borderRadius: palette.radius.xl,
      padding: palette.spacing.xl,
      borderWidth: 1,
      borderColor: palette.colors.border,
      gap: palette.spacing.lg,
    },

    appearanceHeader: {
      gap: palette.spacing.xs,
    },

    appearanceTitle: {
      color: palette.colors.text,
      fontSize: palette.typography.sectionTitle.fontSize,
      fontWeight: '700',
    },
  });
}
