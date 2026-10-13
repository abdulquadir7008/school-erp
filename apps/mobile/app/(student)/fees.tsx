import { Text, View } from "react-native";
import { useFees } from "../../src/api/hooks";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionTitle, StatCard, statusTone } from "../../src/components/ui";

export default function Fees() {
  const { data, isLoading, isError, error, refetch, isFetching } = useFees();
  if (isLoading) return <LoadingView message="Loading fees…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }
  return (
    <Screen refreshing={isFetching} onRefresh={() => refetch()}>
      <View className="flex-row gap-2">
        <StatCard label="Due" value={`₹${Number(data.summary.totalDue).toLocaleString("en-IN")}`} />
        <StatCard label="Paid" value={`₹${Number(data.summary.totalPaid).toLocaleString("en-IN")}`} />
        <StatCard label="Invoices" value={String(data.summary.count)} />
      </View>
      <SectionTitle>Invoices &amp; receipts</SectionTitle>
      {!data.invoices.length ? (
        <EmptyView title="No invoices" hint="Fee invoices will appear here." />
      ) : (
        <View className="gap-2">
          {data.invoices.map((inv: any) => (
            <Card key={inv.id}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono text-sm font-semibold text-slate-900">{inv.invoiceNumber}</Text>
                <Pill text={inv.status} tone={statusTone(inv.status)} />
              </View>
              <Text className="mt-1 text-sm text-slate-600">
                Total ₹{Number(inv.totalAmount).toLocaleString("en-IN")} · Paid ₹
                {Number(inv.paidAmount).toLocaleString("en-IN")}
                {!!Number(inv.fine) && ` · Fine ₹${Number(inv.fine).toLocaleString("en-IN")}`}
              </Text>
              {!!inv.dueDate && (
                <Text className="text-xs text-slate-400">Due {new Date(inv.dueDate).toLocaleDateString()}</Text>
              )}
              {!!inv.payments?.length && (
                <View className="mt-2 border-t border-slate-100 pt-2">
                  {inv.payments.slice(0, 3).map((p: any) => (
                    <Text key={p.id} className="text-xs text-slate-500">
                      ✓ ₹{Number(p.amount).toLocaleString("en-IN")} · {p.method} ·{" "}
                      {new Date(p.paidAt).toLocaleDateString()}
                    </Text>
                  ))}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
