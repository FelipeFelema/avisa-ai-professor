import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { AUTH_THEME } from '@/theme/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
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

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>Meu perfil</Text>
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

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
            isSigningOut && styles.logoutButtonDisabled,
          ]}
          onPress={handleLogout}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator color={AUTH_THEME.colors.white} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={AUTH_THEME.colors.white} />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </>
          )}
        </Pressable>
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

  logoutButton: {
    backgroundColor: AUTH_THEME.colors.error,
    borderRadius: AUTH_THEME.radius.md,
    paddingVertical: AUTH_THEME.spacing.md,
    paddingHorizontal: AUTH_THEME.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: AUTH_THEME.spacing.sm,
  },

  logoutButtonPressed: {
    opacity: 0.9,
  },

  logoutButtonDisabled: {
    opacity: 0.8,
  },

  logoutText: {
    color: AUTH_THEME.colors.white,
    fontSize: AUTH_THEME.typography.body,
    fontWeight: '800',
  },
});
