import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFees } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader, StatCard, statusTone } from "../../src/components/ui";

export default function Fees() {
  const { data, isLoading, isError, error, refetch, isFetching } = useFees();
  if (isLoading) return <LoadingView message="Loading fees…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => refetch()}>
        <View className="rounded-[24px] bg-ink p-5">
          <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/60">Outstanding balance</Text>
          <Text className="mt-1 text-[28px] font-extrabold text-white">₹{Number(data.summary.totalDue).toLocaleString("en-IN")}</Text>
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1 rounded-2xl bg-white/10 p-3">
              <Text className="text-[11px] font-bold text-white/60">PAID</Text>
              <Text className="text-[15px] font-extrabold text-emerald-300">₹{Number(data.summary.totalPaid).toLocaleString("en-IN")}</Text>
            </View>
            <View className="flex-1 rounded-2xl bg-white/10 p-3">
              <Text className="text-[11px] font-bold text-white/60">INVOICES</Text>
              <Text className="text-[15px] font-extrabold text-white">{data.summary.count}</Text>
            </View>
          </View>
        </View>
        <SectionHeader title="Invoices & receipts" subtitle="Tap office to pay offline" />
        {!data.invoices.length ? (
          <EmptyView title="No invoices" hint="Fee invoices will appear here." icon="wallet-outline" />
        ) : (
          <View className="gap-2.5">
            {data.invoices.map((inv: any) => (
              <Card key={inv.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
                      <Ionicons name="receipt-outline" size={18} color="#059669" />
                    </View>
                    <Text className="font-mono text-[13px] font-bold text-ink">{inv.invoiceNumber}</Text>
                  </View>
                  <Pill text={inv.status} tone={statusTone(inv.status)} />
                </View>
                <Text className="mt-2.5 text-[13px] font-semibold text-slate-700">
                  Total ₹{Number(inv.totalAmount).toLocaleString("en-IN")} · Paid ₹{Number(inv.paidAmount).toLocaleString("en-IN")}
                  {!!Number(inv.fine) && ` · Fine ₹${Number(inv.fine).toLocaleString("en-IN")}`}
                </Text>
                {!!inv.dueDate && (
                  <Text className="mt-0.5 text-[11px] text-slate-400">Due {new Date(inv.dueDate).toLocaleDateString()}</Text>
                )}
                {!!inv.payments?.length && (
                  <View className="mt-2.5 gap-1.5 border-t border-slate-100 pt-2.5">
                    {inv.payments.slice(0, 3).map((p: any) => (
                      <View key={p.id} className="flex-row items-center gap-1.5">
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                        <Text className="text-[12px] text-slate-500">
                          ₹{Number(p.amount).toLocaleString("en-IN")} · {p.method} · {new Date(p.paidAt).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
