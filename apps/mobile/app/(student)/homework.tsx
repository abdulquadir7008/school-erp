import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useQueryClient } from "@tanstack/react-query";
import { useHomework, useStudentAssignments } from "../../src/api/hooks";
import { mobileApi } from "../../src/api/mobile";
import { getApiErrorMessage } from "../../src/api/client";
import { Card, EmptyView, ErrorView, LoadingView, Pill, Screen, SectionHeader } from "../../src/components/ui";

type Tab = "ALL" | "PENDING" | "COMPLETED" | "OVERDUE";
type ATab = "ALL" | "UPCOMING" | "PENDING" | "SUBMITTED" | "RETURNED" | "GRADED" | "OVERDUE";

const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Completed" },
  { key: "OVERDUE", label: "Overdue" },
];

const ATABS: { key: ATab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "PENDING", label: "Pending" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "RETURNED", label: "Returned" },
  { key: "GRADED", label: "Graded" },
  { key: "OVERDUE", label: "Overdue" },
];

function statusTone(status: string): "green" | "red" | "amber" | "slate" {
  if (status === "COMPLETED" || status === "GRADED") return "green";
  if (status === "OVERDUE" || status === "NOT_SUBMITTED") return "red";
  return "amber";
}

function dueLabel(dueDate: string, isOverdue: boolean): { text: string; color: string } {
  const due = new Date(dueDate);
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (isOverdue || days < 0) return { text: `Overdue · was due ${due.toLocaleDateString()}`, color: "#DC2626" };
  if (days === 0) return { text: "Due today", color: "#D97706" };
  if (days === 1) return { text: "Due tomorrow", color: "#D97706" };
  if (days <= 3) return { text: `Due in ${days} days · ${due.toLocaleDateString()}`, color: "#D97706" };
  return { text: `Due ${due.toLocaleDateString()}`, color: "#64748B" };
}

function assignmentTabOf(a: any): ATab {
  const s = a.submissionStatus || "NOT_SUBMITTED";
  if (s === "GRADED") return "GRADED";
  if (s === "RETURNED_FOR_REVISION") return "RETURNED";
  if (["SUBMITTED", "LATE_SUBMITTED", "UNDER_REVIEW", "RESUBMITTED"].includes(s)) return "SUBMITTED";
  if (a.myStatus === "OVERDUE" || a.isOverdue) return "OVERDUE";
  if (new Date(a.dueDate).getTime() > Date.now()) return "UPCOMING";
  return "PENDING";
}

function assignmentStatusLabel(a: any): string {
  const s = a.submissionStatus || "NOT_SUBMITTED";
  if (a.myStatus === "OVERDUE") return "Overdue";
  if (s === "NOT_SUBMITTED") return "Pending";
  if (s === "LATE_SUBMITTED") return "Submitted late";
  if (s === "UNDER_REVIEW") return "Under review";
  if (s === "RETURNED_FOR_REVISION") return "Returned";
  if (s === "RESUBMITTED") return "Resubmitted";
  if (s === "GRADED") return "Graded";
  return "Submitted";
}

function canSubmit(a: any): boolean {
  const s = a.submissionStatus || "NOT_SUBMITTED";
  return ["NOT_SUBMITTED", "RETURNED_FOR_REVISION", "SUBMITTED", "LATE_SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(s);
}

function attachmentsOf(h: any): string[] {
  if (Array.isArray(h.attachments)) return h.attachments.filter(Boolean);
  return [];
}

export default function Homework() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch, isFetching } = useHomework();
  const assignments = useStudentAssignments();
  const [section, setSection] = useState<"HOMEWORK" | "ASSIGNMENTS">("HOMEWORK");
  const [tab, setTab] = useState<Tab>("ALL");
  const [atab, setAtab] = useState<ATab>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // assignment submit state
  const [aExpanded, setAExpanded] = useState<string | null>(null);
  const [aText, setAText] = useState("");
  const [aFiles, setAFiles] = useState<{ uri: string; name: string; mimeType: string }[]>([]);
  const [aBusy, setABusy] = useState(false);
  const [aNotice, setANotice] = useState<string | null>(null);

  const homework = useMemo(() => {
    const list = data?.homework || [];
    if (tab === "ALL") return list;
    if (tab === "COMPLETED") return list.filter((h: any) => h.myStatus === "COMPLETED" || h.completionStatus === "COMPLETED");
    if (tab === "OVERDUE") return list.filter((h: any) => h.myStatus === "OVERDUE" || h.isOverdue);
    return list.filter((h: any) => (h.completionStatus || h.myStatus || "PENDING") === "PENDING" && !h.isOverdue && h.myStatus !== "OVERDUE");
  }, [data, tab]);

  const counts = useMemo(() => {
    const list = data?.homework || [];
    return {
      all: list.length,
      pending: list.filter((h: any) => (h.completionStatus || "PENDING") === "PENDING" && !h.isOverdue && h.myStatus !== "OVERDUE").length,
      completed: list.filter((h: any) => h.myStatus === "COMPLETED" || h.completionStatus === "COMPLETED").length,
      overdue: list.filter((h: any) => h.myStatus === "OVERDUE" || h.isOverdue).length,
    };
  }, [data]);

  const assignmentList = useMemo(() => {
    const list = assignments.data || [];
    if (atab === "ALL") return list;
    return list.filter((a: any) => assignmentTabOf(a) === atab);
  }, [assignments.data, atab]);

  const aCounts = useMemo(() => {
    const list = assignments.data || [];
    const c: Record<ATab, number> = { ALL: list.length, UPCOMING: 0, PENDING: 0, SUBMITTED: 0, RETURNED: 0, GRADED: 0, OVERDUE: 0 };
    for (const a of list) c[assignmentTabOf(a)] += 1;
    return c;
  }, [assignments.data]);

  const submit = async (h: any) => {
    setBusyId(h.id);
    setNotice(null);
    try {
      await mobileApi.submitHomework(h.id, { submissionText: responseText.trim() || undefined });
      setNotice(`"${h.title}" marked as completed.`);
      setResponseText("");
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ["mobile", "homework"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "student-dashboard"] });
    } catch (e) {
      setNotice(getApiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ["image/*", "application/pdf", "text/*", "application/msword", "application/vnd.openxmlformats-officedocument.*"],
      });
      if (res.canceled) return;
      const next = res.assets.map((f) => ({
        uri: f.uri,
        name: f.name || "file",
        mimeType: f.mimeType || "application/octet-stream",
      }));
      setAFiles((prev) => [...prev, ...next].slice(0, 5));
    } catch (e) {
      setANotice(getApiErrorMessage(e));
    }
  };

  const submitAssignment = async (a: any) => {
    if (!aText.trim() && !aFiles.length) {
      setANotice("Add an answer or attach at least one file.");
      return;
    }
    setABusy(true);
    setANotice(null);
    try {
      const ids: string[] = [];
      for (const f of aFiles) {
        const uploaded = await mobileApi.uploadAssignmentFile(f.uri, f.name, f.mimeType);
        ids.push(uploaded.id);
      }
      await mobileApi.submitAssignment(a.id, {
        submissionText: aText.trim() || undefined,
        attachmentIds: ids.length ? ids : undefined,
      });
      setANotice(`"${a.title}" submitted successfully.`);
      setAText("");
      setAFiles([]);
      setAExpanded(null);
      queryClient.invalidateQueries({ queryKey: ["mobile", "student-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["mobile", "homework"] });
    } catch (e) {
      setANotice(getApiErrorMessage(e));
    } finally {
      setABusy(false);
    }
  };

  const downloadFile = async (doc: any) => {
    try {
      const uri = await mobileApi.downloadAssignmentFile(doc.documentId, doc.name || "file");
      const shareable = await Sharing.isAvailableAsync();
      if (shareable) await Sharing.shareAsync(uri);
      else setANotice(`Saved to ${uri}`);
    } catch (e) {
      setANotice(getApiErrorMessage(e));
    }
  };

  if (isLoading) return <LoadingView message="Loading homework…" />;
  if (isError || !data) {
    return <Screen><ErrorView message={getApiErrorMessage(error)} onRetry={() => refetch()} /></Screen>;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <Screen refreshing={isFetching} onRefresh={() => { refetch(); assignments.refetch(); }}>
        <View className="mb-3 flex-row gap-2">
          {(["HOMEWORK", "ASSIGNMENTS"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSection(s)}
              className={`flex-1 items-center rounded-2xl py-2.5 ${section === s ? "bg-indigo-600" : "bg-slate-100"}`}
            >
              <Text className={`text-[13px] font-extrabold ${section === s ? "text-white" : "text-slate-600"}`}>
                {s === "HOMEWORK" ? `Homework · ${counts.all}` : `Assignments · ${assignments.data?.length ?? 0}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {section === "HOMEWORK" ? (
          <>
            <SectionHeader title="Homework" subtitle={`${counts.pending} pending · ${counts.overdue} overdue`} />
            <View className="mb-3 flex-row gap-2">
              {TABS.map((t) => {
                const n = t.key === "ALL" ? counts.all : t.key === "PENDING" ? counts.pending : t.key === "COMPLETED" ? counts.completed : counts.overdue;
                const active = tab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setTab(t.key)} className={`rounded-full px-3.5 py-2 ${active ? "bg-indigo-600" : "bg-slate-100"}`}>
                    <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-slate-700"}`}>{t.label} · {n}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!!notice && (
              <View className="mb-3 rounded-2xl bg-indigo-50 p-3">
                <Text className="text-[13px] font-semibold text-indigo-900">{notice}</Text>
              </View>
            )}
            {!homework.length ? (
              <EmptyView title={tab === "ALL" ? "No homework" : `No ${tab.toLowerCase()} homework`} hint={tab === "ALL" ? "You're all caught up." : "Nothing in this view right now."} icon="checkmark-done-outline" />
            ) : (
              <View className="gap-2.5">
                {homework.map((h: any) => {
                  const status = h.myStatus || h.completionStatus || "PENDING";
                  const due = dueLabel(h.dueDate, !!h.isOverdue);
                  const done = status === "COMPLETED";
                  const links = attachmentsOf(h);
                  const open = expanded === h.id;
                  return (
                    <Card key={h.id}>
                      <Pressable onPress={() => { setExpanded(open ? null : h.id); setResponseText(h.submission?.submissionText || ""); }}>
                        <View className="flex-row gap-3">
                          <View className={`h-11 w-11 items-center justify-center rounded-2xl ${done ? "bg-green-50" : "bg-amber-50"}`}>
                            <Ionicons name={done ? "checkmark-done" : "pencil"} size={19} color={done ? "#16A34A" : "#D97706"} />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center justify-between gap-2">
                              <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={2}>{h.title}</Text>
                              <Pill text={status === "OVERDUE" ? "Overdue" : status === "COMPLETED" ? "Completed" : "Pending"} tone={statusTone(status)} />
                            </View>
                            {!!h.subject?.name && <Text className="mt-0.5 text-[12px] font-semibold text-indigo-700">{h.subject.name}{h.class?.name ? ` · Class ${h.class.name}${h.section?.name ? `-${h.section.name}` : ""}` : ""}</Text>}
                            {!!(h.teacher?.firstName) && <Text className="text-[12px] text-slate-500">{h.teacher.firstName} {h.teacher.lastName}</Text>}
                            {!!h.description && <Text className="mt-0.5 text-[13px] leading-5 text-slate-600" numberOfLines={open ? undefined : 2}>{h.description}</Text>}
                            <View className="mt-2 flex-row items-center gap-1.5">
                              <Ionicons name="alarm-outline" size={13} color={due.color} />
                              <Text className="text-[11px] font-bold" style={{ color: due.color }}>{due.text}</Text>
                            </View>
                            {!!links.length && (
                              <View className="mt-1.5 gap-1">
                                {links.map((u: string) => (
                                  <Text key={u} className="text-[12px] text-indigo-600" numberOfLines={1}>Attachment: {u}</Text>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      </Pressable>
                      {open && !done && (
                        <View className="mt-3 border-t border-slate-100 pt-3">
                          <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">Your response (optional)</Text>
                          <TextInput className="rounded-2xl bg-slate-50 px-4 py-3 text-[14px] text-ink" value={responseText} onChangeText={setResponseText} placeholder="What did you complete?" placeholderTextColor="#94A3B8" multiline numberOfLines={3} textAlignVertical="top" />
                          <Pressable className="mt-2 items-center rounded-2xl bg-indigo-600 py-3 active:opacity-85" onPress={() => submit(h)} disabled={busyId === h.id}>
                            <Text className="text-[14px] font-extrabold text-white">{busyId === h.id ? "Submitting…" : "Mark as completed"}</Text>
                          </Pressable>
                        </View>
                      )}
                      {open && done && !!h.submission?.submittedAt && (
                        <View className="mt-3 rounded-2xl bg-green-50 p-3">
                          <Text className="text-[13px] font-semibold text-green-900">
                            Completed {new Date(h.submission.submittedAt).toLocaleDateString()}
                            {h.submission?.teacherRemark ? ` · Teacher: ${h.submission.teacherRemark}` : ""}
                          </Text>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Assignments" subtitle={`${aCounts.PENDING} pending · ${aCounts.OVERDUE} overdue · ${aCounts.GRADED} graded`} />
            <View className="mb-3 flex-row flex-wrap gap-2">
              {ATABS.map((t) => {
                const active = atab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setAtab(t.key)} className={`rounded-full px-3 py-2 ${active ? "bg-indigo-600" : "bg-slate-100"}`}>
                    <Text className={`text-[12px] font-bold ${active ? "text-white" : "text-slate-700"}`}>{t.label} · {aCounts[t.key]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!!aNotice && (
              <View className="mb-3 rounded-2xl bg-indigo-50 p-3">
                <Text className="text-[13px] font-semibold text-indigo-900">{aNotice}</Text>
              </View>
            )}
            {assignments.isLoading ? (
              <LoadingView message="Loading assignments…" />
            ) : assignments.isError ? (
              <ErrorView message={getApiErrorMessage(assignments.error)} onRetry={() => assignments.refetch()} />
            ) : !assignmentList.length ? (
              <EmptyView title={atab === "ALL" ? "No assignments" : `No ${atab.toLowerCase()} assignments`} hint={atab === "ALL" ? "You're all caught up." : "Nothing in this view right now."} icon="document-text-outline" />
            ) : (
              <View className="gap-2.5">
                {assignmentList.map((a: any) => {
                  const label = assignmentStatusLabel(a);
                  const due = dueLabel(a.dueDate, !!a.isOverdue);
                  const open = aExpanded === a.id;
                  const subDocs = Array.isArray(a.submission?.attachments) ? a.submission.attachments : [];
                  const refs = attachmentsOf(a);
                  const editable = canSubmit(a);
                  return (
                    <Card key={a.id}>
                      <Pressable onPress={() => { setAExpanded(open ? null : a.id); setAText(a.submission?.submissionText || ""); setAFiles([]); }}>
                        <View className="flex-row gap-3">
                          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                            <Ionicons name="document-text" size={19} color="#4F46E5" />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center justify-between gap-2">
                              <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={2}>{a.title}</Text>
                              <Pill text={label} tone={statusTone(a.submissionStatus || (a.myStatus === "OVERDUE" ? "OVERDUE" : "PENDING"))} />
                            </View>
                            <Text className="mt-0.5 text-[12px] font-semibold text-indigo-700">
                              {a.subject?.name || "General"} · {a.type}{a.totalMarks != null ? ` · ${a.totalMarks} marks` : ""}
                            </Text>
                            {!!(a.teacher?.firstName) && <Text className="text-[12px] text-slate-500">{a.teacher.firstName} {a.teacher.lastName}</Text>}
                            <View className="mt-2 flex-row items-center gap-1.5">
                              <Ionicons name="alarm-outline" size={13} color={due.color} />
                              <Text className="text-[11px] font-bold" style={{ color: due.color }}>{due.text}</Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                      {open && (
                        <View className="mt-3 border-t border-slate-100 pt-3">
                          {!!a.description && <Text className="text-[13px] leading-5 text-slate-600">{a.description}</Text>}
                          {!!a.instructions && (
                            <View className="mt-2 rounded-2xl bg-slate-50 p-3">
                              <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Instructions</Text>
                              <Text className="mt-1 text-[13px] leading-5 text-slate-700">{a.instructions}</Text>
                            </View>
                          )}
                          {!!a.gradingCriteria && <Text className="mt-2 text-[12px] text-slate-500">Rubric: {a.gradingCriteria}</Text>}
                          {!!refs.length && (
                            <View className="mt-2 gap-1">
                              {refs.map((u: string) => (
                                <Text key={u} className="text-[12px] text-indigo-600" numberOfLines={1}>Reference: {u}</Text>
                              ))}
                            </View>
                          )}
                          {a.submission?.gradesPublished && a.submission?.marksObtained != null && (
                            <View className="mt-2 rounded-2xl bg-green-50 p-3">
                              <Text className="text-[13px] font-extrabold text-green-900">
                                {a.submission.marksObtained}{a.totalMarks != null ? ` / ${a.totalMarks}` : ""}
                              </Text>
                              {!!a.submission?.feedback && <Text className="mt-1 text-[13px] text-green-900">Feedback: {a.submission.feedback}</Text>}
                            </View>
                          )}
                          {a.submissionStatus === "RETURNED_FOR_REVISION" && !!a.submission?.feedback && (
                            <View className="mt-2 rounded-2xl bg-amber-50 p-3">
                              <Text className="text-[13px] font-semibold text-amber-900">Teacher asked for changes: {a.submission.feedback}</Text>
                            </View>
                          )}
                          {editable ? (
                            <View className="mt-2">
                              <Text className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">Your answer</Text>
                              <TextInput className="rounded-2xl bg-slate-50 px-4 py-3 text-[14px] text-ink" value={aText} onChangeText={setAText} placeholder="Type your answer…" placeholderTextColor="#94A3B8" multiline numberOfLines={4} textAlignVertical="top" />
                              <View className="mt-2 gap-1.5">
                                {aFiles.map((f) => (
                                  <View key={f.uri} className="flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                                    <Text className="flex-1 text-[12px] text-slate-700" numberOfLines={1}>{f.name}</Text>
                                    <Pressable onPress={() => setAFiles((p) => p.filter((x) => x.uri !== f.uri))}>
                                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                    </Pressable>
                                  </View>
                                ))}
                              </View>
                              <View className="mt-2 flex-row gap-2">
                                <Pressable className="flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-slate-100 py-3" onPress={pickFiles} disabled={aBusy || aFiles.length >= 5}>
                                  <Ionicons name="attach-outline" size={16} color="#475569" />
                                  <Text className="text-[13px] font-extrabold text-slate-700">Attach ({aFiles.length}/5)</Text>
                                </Pressable>
                                <Pressable className="flex-1 items-center rounded-2xl bg-indigo-600 py-3 active:opacity-85" onPress={() => submitAssignment(a)} disabled={aBusy}>
                                  <Text className="text-[13px] font-extrabold text-white">{aBusy ? "Submitting…" : a.submission ? "Resubmit" : "Submit"}</Text>
                                </Pressable>
                              </View>
                              {!!subDocs.length && (
                                <View className="mt-2 gap-1.5">
                                  <Text className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Submitted files</Text>
                                  {subDocs.map((d: any) => (
                                    <Pressable key={d.documentId} className="flex-row items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2" onPress={() => downloadFile(d)}>
                                      <Ionicons name="download-outline" size={16} color="#4F46E5" />
                                      <Text className="flex-1 text-[12px] font-semibold text-indigo-900" numberOfLines={1}>{d.name}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              )}
                            </View>
                          ) : (
                            !!a.submission?.submittedAt && (
                              <View className="mt-2 rounded-2xl bg-slate-50 p-3">
                                <Text className="text-[13px] font-semibold text-slate-700">
                                  Submitted {new Date(a.submission.submittedAt).toLocaleDateString()}
                                  {a.submission?.isLate ? " · late" : ""}
                                </Text>
                              </View>
                            )
                          )}
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </Screen>
    </SafeAreaView>
  );
}
