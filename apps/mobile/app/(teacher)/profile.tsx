import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useAuthStore } from "../../src/store/auth";
import { changePasswordRequest } from "../../src/api/mobile";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";

export default function TeacherProfile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doChange = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await changePasswordRequest(current, next);
      setMsg("Password changed successfully.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen refreshing={false} onRefresh={refreshProfile}>
      <Card>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-100">
          <Text className="text-2xl font-bold text-primary-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text className="mt-2 text-xl font-bold text-slate-900">
          {user?.firstName} {user?.lastName}
        </Text>
        <Muted>{user?.username ? `@${user?.username}` : user?.email}</Muted>
        {!!user?.teacher && (
          <Text className="mt-1 text-sm text-slate-600">
            {user.teacher.employeeId}
            {user.teacher.specialization ? ` · ${user.teacher.specialization}` : ""}
          </Text>
        )}
        {!!user?.school && <Text className="text-xs text-slate-400">{user.school.name}</Text>}
      </Card>

      <SectionTitle>Change password</SectionTitle>
      <Card>
        <Text className="mb-1 text-xs font-medium text-slate-500">Current password</Text>
        <TextInput className="rounded-xl border border-slate-200 px-3 py-2.5" secureTextEntry value={current} onChangeText={setCurrent} />
        <Text className="mb-1 mt-3 text-xs font-medium text-slate-500">New password (min 8 chars)</Text>
        <TextInput className="rounded-xl border border-slate-200 px-3 py-2.5" secureTextEntry value={next} onChangeText={setNext} />
        {!!msg && <Text className="mt-2 text-sm text-slate-600">{msg}</Text>}
        <Pressable className="mt-3 items-center rounded-xl bg-sidebar py-3" onPress={doChange} disabled={busy}>
          <Text className="font-bold text-white">{busy ? "Saving…" : "Update password"}</Text>
        </Pressable>
      </Card>

      <Pressable className="mt-4 items-center rounded-xl bg-red-50 py-4" onPress={logout}>
        <Text className="font-bold text-red-600">Log out</Text>
      </Pressable>
    </Screen>
  );
}
