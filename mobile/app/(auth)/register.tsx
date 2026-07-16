import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const router = useRouter();

  const [, setIsTeacher] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View>
        <Text>Cadastro</Text>

        <Pressable onPress={() => setIsTeacher(false)}>
          <Text>Responsável</Text>
        </Pressable>
        <Pressable onPress={() => setIsTeacher(true)}>
          <Text>Professor</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')}>
          <Text>Já possui uma conta? Entrar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
