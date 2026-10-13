import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../src/store/auth";

export default function Login() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 px-6 pb-8 pt-10">
          {/* Brand */}
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary-600">
              <Ionicons name="school" size={26} color="#fff" />
            </View>
            <View>
              <Text className="text-[20px] font-extrabold tracking-tight text-ink">SchoolSphere</Text>
              <Text className="text-[12px] font-semibold text-slate-400">Learn · Teach · Thrive</Text>
            </View>
          </View>

          {/* Hero copy */}
          <Text className="mt-8 text-[28px] font-extrabold leading-9 tracking-tight text-ink">
            Welcome back{"\n"}to your classroom
          </Text>
          <Text className="mt-2 text-[13px] leading-5 text-slate-500">
            Students and teachers sign in with the username issued by the school office.
          </Text>

          {/* Form card */}
          <View className="mt-6 rounded-[24px] border border-slate-100 bg-white p-5">
            <Text className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Username or email
            </Text>
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="person-outline" size={18} color="#94A3B8" />
              <TextInput
                className="flex-1 py-3.5 text-[15px] text-ink"
                placeholder="e.g. stuadm1024"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={setIdentifier}
                returnKeyType="next"
              />
            </View>

            <Text className="mt-4 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </Text>
            <View className="mt-2 flex-row items-center gap-2 rounded-2xl bg-slate-50 px-4">
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
              <TextInput
                className="flex-1 py-3.5 text-[15px] text-ink"
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPw}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={19} color="#64748B" />
              </Pressable>
            </View>

            {!!error && (
              <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-red-50 p-3">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text className="flex-1 text-[13px] font-semibold text-red-700">{error}</Text>
              </View>
            )}

            <Pressable
              className="mt-5 items-center rounded-2xl bg-primary-600 py-4 active:opacity-85"
              onPress={submit}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Text className="text-[15px] font-extrabold text-white">
                {isLoading ? "Signing in…" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center gap-2 rounded-[20px] bg-primary-50 p-4">
            <Ionicons name="information-circle-outline" size={20} color="#4F46E5" />
            <Text className="flex-1 text-[12px] leading-5 text-primary-900">
              Forgot password? Contact your school office to reset it. Students see learning, teachers see
              classes.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
