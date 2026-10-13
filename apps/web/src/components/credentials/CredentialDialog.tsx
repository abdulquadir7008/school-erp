"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Copy, Download, Loader2, Power, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, getErrorMessage } from "@/lib/api";

interface Props {
  kind: "student" | "teacher";
  recordId: string;
  label: string;
  compact?: boolean;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CredentialDialog({ kind, recordId, label, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [lastCreds, setLastCreds] = useState<{ username: string | null; tempPassword: string | null } | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["credential-status", kind, recordId],
    queryFn: async () => {
      const res = await api.get(`/credentials/${kind}s/${recordId}/status`);
      return res.data.data;
    },
    enabled: open,
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/credentials/${kind}s/${recordId}/provision`, {
        ...(username ? { username } : {}),
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setLastCreds({ username: data.username, tempPassword: data.tempPassword });
      toast.success(data.created ? "Login account created" : "Account already exists");
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["credential-status"] });
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/credentials/users/${userId}/reset-password`);
      return res.data.data;
    },
    onSuccess: (data) => {
      setLastCreds({ username: data.username, tempPassword: data.tempPassword });
      toast.success("Password reset — share the new temporary password");
      statusQuery.refetch();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const res = await api.patch(`/credentials/users/${userId}/active`, { isActive });
      return res.data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "Mobile access enabled" : "Mobile access disabled");
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/credentials/${kind}s/${recordId}/unlink`);
    },
    onSuccess: () => {
      toast.success("Login unlinked and deactivated");
      setLastCreds(null);
      statusQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["app-logins"] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const status = statusQuery.data;
  const user = status?.user;

  const copyCreds = () => {
    if (!lastCreds?.username || !lastCreds?.tempPassword) return;
    navigator.clipboard.writeText(
      `SchoolSphere login\nUsername: ${lastCreds.username}\nPassword: ${lastCreds.tempPassword}\n(${label})`
    );
    toast.success("Credentials copied");
  };

  if (!open) {
    return (
      <Button
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "sm"}
        title={`App login for ${label}`}
        onClick={() => setOpen(true)}
      >
        <KeyRound className="h-4 w-4" />
        {!compact && <span className="ms-2">App login</span>}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-base font-semibold">App login — {label}</h3>
          <button className="text-sm text-slate-400 hover:text-slate-700" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Credentials work in the SchoolSphere mobile app (student / teacher role auto-detected).
          Never share passwords over insecure channels.
        </p>

        {statusQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading account status…</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600">Status:</span>
              {user ? (
                <Badge variant={user.isActive ? "success" : "secondary"}>
                  {user.isActive ? `Active · ${user.username || user.email}` : "Disabled"}
                </Badge>
              ) : (
                <Badge variant="secondary">No login yet</Badge>
              )}
              {user?.lastLoginAt && (
                <span className="text-xs text-slate-400">
                  Last login {new Date(user.lastLoginAt).toLocaleString()}
                </span>
              )}
            </div>

            {!user && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Custom username (optional — auto-generated if empty)
                  </label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. stuadm1024" />
                </div>
                <Button
                  className="w-full"
                  disabled={provisionMutation.isPending}
                  onClick={() => provisionMutation.mutate()}
                >
                  {provisionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create mobile login
                </Button>
              </div>
            )}

            {user && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={resetMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Reset password for ${user.username || user.email}? Old sessions will be logged out.`)) {
                      resetMutation.mutate(user.id);
                    }
                  }}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Reset password
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={activeMutation.isPending}
                  onClick={() => activeMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                >
                  <Power className="mr-1 h-3.5 w-3.5" /> {user.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="col-span-2 text-red-600"
                  disabled={unlinkMutation.isPending}
                  onClick={() => {
                    if (window.confirm("Unlink this login? The user account will be deactivated.")) {
                      unlinkMutation.mutate();
                    }
                  }}
                >
                  <Unlink className="mr-1 h-3.5 w-3.5" /> Unlink login
                </Button>
              </div>
            )}

            {lastCreds?.tempPassword && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">Temporary credentials (shown once — copy now)</p>
                <p className="mt-1 font-mono text-sm">Username: {lastCreds.username}</p>
                <p className="font-mono text-sm">Password: {lastCreds.tempPassword}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyCreds}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() =>
                      downloadText(
                        `schoolsphere-login-${lastCreds.username}.txt`,
                        `SchoolSphere ERP — Mobile App Login\nName: ${label}\nUsername: ${lastCreds.username}\nTemporary password: ${lastCreds.tempPassword}\n\nPlease log in and change your password immediately.`
                      )
                    }
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
