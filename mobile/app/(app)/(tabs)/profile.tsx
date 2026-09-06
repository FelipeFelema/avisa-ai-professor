import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenState } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { AUTH_THEME } from '@/theme/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              Meu perfil
            </Text>
            <Text style={styles.subtitle}>
              Confira suas informações de conta e saia quando precisar.
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="person-outline" size={18} color={AUTH_THEME.colors.primary} />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoLabel}>Nome</Text>
              <Text style={styles.infoValue}>{user.name}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="mail-outline" size={18} color={AUTH_THEME.colors.primary} />
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
                name="shield-checkmark-outline"
                size={18}
                color={AUTH_THEME.colors.primary}
              />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoLabel}>Perfil</Text>
              <Text style={styles.infoValue}>{user.role}</Text>
            </View>
          </View>
        </View>

        <Button
          label="Editar perfil"
          variant="secondary"
          onPress={() => router.push('/profile/edit')}
        />

        <Button
          label="Sair da conta"
          variant="destructive"
          loading={isSigningOut}
          onPress={handleLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AUTH_THEME.colors.background,
  },

  content: {
    flexGrow: 1,
    padding: AUTH_THEME.spacing.xl,
    gap: AUTH_THEME.spacing.xl,
  },

  headerCard: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.xl,
    padding: AUTH_THEME.spacing.xl,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
    gap: AUTH_THEME.spacing.lg,
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: AUTH_THEME.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: AUTH_THEME.colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
  },

  headerCopy: {
    gap: AUTH_THEME.spacing.xs,
  },

  title: {
    fontSize: AUTH_THEME.typography.title,
    fontWeight: '800',
    color: AUTH_THEME.colors.text,
  },

  subtitle: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.body,
    lineHeight: 22,
  },

  infoCard: {
    backgroundColor: AUTH_THEME.colors.surface,
    borderRadius: AUTH_THEME.radius.xl,
    padding: AUTH_THEME.spacing.xl,
    borderWidth: 1,
    borderColor: AUTH_THEME.colors.border,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AUTH_THEME.spacing.md,
  },

  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: AUTH_THEME.radius.pill,
    backgroundColor: AUTH_THEME.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoTextBlock: {
    flex: 1,
    gap: 2,
  },

  infoLabel: {
    color: AUTH_THEME.colors.muted,
    fontSize: AUTH_THEME.typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  infoValue: {
    color: AUTH_THEME.colors.text,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '700',
  },

  separator: {
    height: 1,
    backgroundColor: AUTH_THEME.colors.border,
    marginVertical: AUTH_THEME.spacing.lg,
  },
});
