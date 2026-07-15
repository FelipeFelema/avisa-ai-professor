import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
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
          <TextInput placeholder="E-mail" />

          <TextInput placeholder="Senha" secureTextEntry />

          <Pressable>
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
