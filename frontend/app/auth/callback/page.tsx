"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { login } from "@/store/slices/authSlice";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const userStr = searchParams.get("user");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError("Authentication failed or was cancelled. Please try again.");
      setTimeout(() => {
        router.push("/login");
      }, 2500);
      return;
    }

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        localStorage.setItem("pdf_session_token", token);
        localStorage.setItem("pdf_user", JSON.stringify(user));
        dispatch(login(user));

        setTimeout(() => {
          router.push("/");
        }, 800);
      } catch {
        setError("Invalid authentication response format.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } else {
      setError("No authentication token received.");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
  }, [searchParams, dispatch, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-slate-200 shadow-xl flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-6">
          <Logo className="w-12 h-12" />
          <span className="font-extrabold text-2xl tracking-tight text-[#33333B]">
            QuickPDF
          </span>
        </div>

        {error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Sign-in Notice</h2>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <p className="text-xs text-slate-400">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
              <Loader2 className="w-6 h-6 animate-spin text-[#E5322D]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Connecting Account...</h2>
            <p className="text-sm text-slate-500 mb-2">Signing you in securely with QuickPDF.</p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mt-2">
              <CheckCircle2 className="w-4 h-4" />
              Verified successfully! Redirecting...
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="w-8 h-8 animate-spin text-[#E5322D]" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
