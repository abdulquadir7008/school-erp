import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/auth";
import { changePasswordRequest } from "../../src/api/mobile";
import { getApiErrorMessage } from "../../src/api/client";
import { Avatar, Card, Screen, SectionHeader } from "../../src/components/ui";

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const s = user?.student;
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Student";

  const doChange = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await changePasswordRequest(current, next);
      setMsg("Password changed. You may need to log in again on other devices.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={false} onRefresh={refreshProfile}>
        <View className="items-center rounded-[24px] bg-ink p-6">
          <Avatar name={fullName} size={72} bg="#4F46E5" />
          <Text className="mt-3 text-[19px] font-extrabold text-white">{fullName}</Text>
          <Text className="mt-0.5 text-[13px] text-white/70">{user?.username ? `@${user.username}` : user?.email}</Text>
          {!!s && (
            <View className="mt-3 flex-row gap-2">
              <View className="rounded-full bg-white/15 px-3 py-1.5">
                <Text className="text-[11px] font-bold text-white">{s.class?.name}{s.section?.name ? ` · ${s.section.name}` : ""}</Text>
              </View>
              <View className="rounded-full bg-white/15 px-3 py-1.5">
                <Text className="text-[11px] font-bold text-white">Adm {s.admissionNumber}</Text>
              </View>
            </View>
          )}
          {!!user?.school && <Text className="mt-2.5 text-[11px] text-white/50">{user.school.name}</Text>}
        </View>

        <SectionHeader title="Security" subtitle="Keep your account safe" />
        <Card>
          <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Current password</Text>
          <TextInput
            className="mt-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-[15px] text-ink"
            secureTextEntry value={current} onChangeText={setCurrent} placeholder="••••••••" placeholderTextColor="#94A3B8"
          />
          <Text className="mt-3 text-[12px] font-bold uppercase tracking-wide text-slate-400">New password (min 8 chars)</Text>
          <TextInput
            className="mt-1.5 rounded-2xl bg-slate-50 px-4 py-3 text-[15px] text-ink"
            secureTextEntry value={next} onChangeText={setNext} placeholder="Choose a strong password" placeholderTextColor="#94A3B8"
          />
          {!!msg && (
            <View className="mt-3 rounded-2xl bg-slate-50 p-3">
              <Text className="text-[12px] font-semibold text-slate-600">{msg}</Text>
            </View>
          )}
          <Pressable className="mt-4 items-center rounded-2xl bg-primary-600 py-3.5 active:opacity-85" onPress={doChange} disabled={busy}>
            <Text className="text-[14px] font-extrabold text-white">{busy ? "Saving…" : "Update password"}</Text>
          </Pressable>
        </Card>

        <Pressable className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-red-50 py-4 active:opacity-80" onPress={logout}>
          <Ionicons name="log-out-outline" size={19} color="#DC2626" />
          <Text className="text-[14px] font-extrabold text-red-600">Log out</Text>
        </Pressable>
      </Screen>
    </SafeAreaView>
  );
}
