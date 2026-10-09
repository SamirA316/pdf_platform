"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { login } from "@/store/slices/authSlice";
import { confirmLoginWithToken } from "@/lib/api/auth";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmedUser, setConfirmedUser] = useState<any>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (!token || !email) {
      setError("Invalid or missing confirmation link parameters.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function verifyLink() {
      try {
        const result = await confirmLoginWithToken({
          email: decodeURIComponent(email as string),
          token: token as string,
        });

        const authedUser = result.user || (result as any)?.data?.user;
        const authedToken = result.token;

        if (authedUser) {
          if (isMounted) {
            setConfirmedUser(authedUser);
            dispatch(login(authedUser));
          }

          // Broadcast to any open popup window / tab
          try {
            const channel = new BroadcastChannel("quickpdf_auth");
            channel.postMessage({
              type: "OAUTH_SUCCESS",
              token: authedToken,
              user: authedUser,
            });
            channel.close();
          } catch {
            // BroadcastChannel fallback ignored
          }

          setTimeout(() => {
            router.push("/");
          }, 1200);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "This confirmation link has expired or is invalid.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifyLink();

    return () => {
      isMounted = false;
    };
  }, [searchParams, dispatch, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-2xl flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-8">
          <Logo className="w-12 h-12" />
          <span className="font-extrabold text-2xl tracking-tight text-[#0F172A]">
            Quick<span className="text-[#E5322D]">PDF</span>
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#E5322D] mb-4">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Confirming Sign-in...</h2>
            <p className="text-sm text-slate-500">
              Verifying your direct confirmation link from Gmail...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Confirmation Notice</h2>
            <p className="text-sm text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-2.5 rounded-xl bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold text-sm transition-all shadow-sm"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Sign-in Confirmed!
            </h2>
            <p className="text-sm text-slate-600 mb-2">
              Welcome back,{" "}
              <span className="font-semibold text-slate-900">
                {confirmedUser?.name || "User"}
              </span>
              !
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Redirecting to your workspace...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="w-8 h-8 animate-spin text-[#E5322D]" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
