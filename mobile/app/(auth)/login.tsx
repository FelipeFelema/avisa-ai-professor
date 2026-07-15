import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/validations/login.schema';

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

  const onSubmit = (data: LoginFormData) => {
    console.log(data);
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

          {errors.email && <Text>{errors.email.message}</Text>}

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

          {errors.password && <Text>{errors.password.message}</Text>}

          <Pressable onPress={handleSubmit(onSubmit)}>
            <Text>Entrar</Text>
          </Pressable>
        </View>

        {/* Registration shortcut */}
        <View>
          <Text>Não possui uma conta?</Text>

          <Pressable>
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
