import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/validations/login.schema';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { HTTP_STATUS } from '@/constants/http-status';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { login } = useAuth();

  const router = useRouter();

  const [loginError, setLoginError] = useState('');

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (response) => {
      console.log(response);
    },
    onError: (error) => {
      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.UNAUTHORIZED) {
        setLoginError('E-mail ou senha inválidos.');
        return;
      }

      if (isAxiosError(error) && !error.response) {
        setLoginError('Verifique sua conexão com a internet.');
        return;
      }

      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        setLoginError('Ocorreu um erro no servidor. Tente novamente mais tarde.');
        return;
      }

      setLoginError('Não foi possível realizar o login.');
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(''); // Clear any previous error messages
    await loginMutation.mutateAsync(data);
  };
  return (
    <SafeAreaView style={styles.container}>
      <View>
        {/* Authentication header */}
        <View>
          <Text>Avisa Aí Professor</Text>
          <Text>Bem-vindo de volta!</Text>
        </View>

        {/* Login Form */}
        <View>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="E-mail"
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
          />
          {errors.email?.message ? <Text>{errors.email.message}</Text> : null}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <TextInput
                placeholder="Senha"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
              />
            )}
          />
          {errors.password?.message ? <Text>{errors.password.message}</Text> : null}
          {loginError ? <Text>{loginError}</Text> : null}
          <Pressable onPress={handleSubmit(onSubmit)} disabled={loginMutation.isPending}>
            <Text>{loginMutation.isPending ? 'Entrando...' : 'Entrar'}</Text>
          </Pressable>
        </View>

        {/* Registration shortcut */}
        <View>
          <Text>Não possui uma conta?</Text>

          <Pressable onPress={() => router.push('/register')}>
            <Text>Criar conta</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
});
