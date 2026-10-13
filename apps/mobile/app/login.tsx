import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/auth";

export default function Login() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href="/" />;

  const submit = async () => {
    setError(null);
    if (!identifier.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    try {
      await login(identifier, password);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View className="flex-1 bg-sidebar px-6 pb-10 pt-20">
      <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-primary-600">
        <Text className="text-2xl font-bold text-white">S</Text>
      </View>
      <Text className="text-3xl font-bold text-white">SchoolSphere</Text>
      <Text className="mt-1 text-sm text-slate-400">
        Student &amp; Teacher app — log in with the username given by your school.
      </Text>

      <View className="mt-8 gap-3">
        <View>
          <Text className="mb-1 text-sm font-medium text-slate-300">Username or email</Text>
          <TextInput
            className="rounded-xl bg-white px-4 py-3 text-base text-slate-900"
            placeholder="e.g. stuadm1024"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
          />
        </View>
        <View>
          <Text className="mb-1 text-sm font-medium text-slate-300">Password</Text>
          <TextInput
            className="rounded-xl bg-white px-4 py-3 text-base text-slate-900"
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
        </View>
        {!!error && (
          <View className="rounded-xl bg-red-500/15 p-3">
            <Text className="text-sm text-red-300">{error}</Text>
          </View>
        )}
        <Pressable
          className={`items-center rounded-xl py-4 ${isLoading ? "bg-primary-800" : "bg-primary-600"}`}
          onPress={submit}
          disabled={isLoading}
        >
          <Text className="text-base font-bold text-white">
            {isLoading ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>
        <Text className="mt-2 text-center text-xs text-slate-400">
          Forgot password? Contact your school office to reset it.{"\n"}Students see
          academics · Teachers see classes.
        </Text>
      </View>
    </View>
  );
}
