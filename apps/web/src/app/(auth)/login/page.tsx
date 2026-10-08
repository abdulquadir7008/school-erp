"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Eye, EyeOff, Languages } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/components/language-provider";
import { LANGUAGES, SUPPORTED_LANGS } from "@/lib/i18n";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isDev = process.env.NODE_ENV === "development";

  const demoAccounts = [
    { label: t("auth.roleSuperAdmin"), email: "admin@schoolsphere.test", password: "Admin@2024" },
    { label: t("auth.roleSchoolAdmin"), email: "admin@gis001.test", password: "School@2024" },
    { label: t("auth.roleTeacher"), email: "teacher1@gis001.test", password: "School@2024" },
    { label: t("auth.roleParent"), email: "parent1@gis001.test", password: "School@2024" },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double-submit (e.g. pressing Enter twice quickly).
    if (loading) return;
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      const { user, accessToken, refreshToken } = response.data.data;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      const userInfo = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleName: user.roleName,
        schoolId: user.schoolId,
        isSuperAdmin: user.roleName === "SUPER_ADMIN",
      };

      setAuth({ user: userInfo, accessToken, refreshToken });
      toast.success(t("auth.welcomeBack", { name: user.firstName }));
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.message || t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between bg-slate-900 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">
            {t("nav.brandName")} {t("nav.brandSub")}
          </span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            {t("auth.tagline1")}
            <br />
            {t("auth.tagline1Line2")}
          </h1>
          <p className="mt-4 max-w-md text-slate-400">{t("auth.taglineDesc")}</p>
        </div>

        <div className="space-y-4">
          {[
            { title: t("auth.feature1"), desc: t("auth.feature1Desc") },
            { title: t("auth.feature2"), desc: t("auth.feature2Desc") },
            { title: t("auth.feature3"), desc: t("auth.feature3Desc") },
          ].map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
              <div>
                <p className="text-sm font-medium text-white">{feature.title}</p>
                <p className="text-sm text-slate-400">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-end">
            <div
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
              role="group"
              aria-label={t("lang.interfaceLanguage")}
            >
              <Languages className="ms-1 h-4 w-4 text-slate-400" />
              {SUPPORTED_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    lang === code
                      ? "bg-primary-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {LANGUAGES[code].nativeLabel}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg font-semibold">
              {t("nav.brandName")} {t("nav.brandSub")}
            </span>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">{t("auth.signIn")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("auth.credentialsHint")}</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("auth.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("auth.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 pe-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={t("auth.togglePassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary-600 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          {isDev && (
            <div className="mt-8">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                {t("auth.demoAccounts")}
              </p>
              <div className="grid gap-1.5">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email, acc.password)}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-start text-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
                  >
                    <span className="font-medium text-slate-700">{acc.label}</span>
                    <span className="text-xs text-slate-400">{acc.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
