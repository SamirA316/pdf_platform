"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ShieldCheck, Mail, ArrowLeft, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { sendSocialConfirmationCode, checkConfirmStatus } from "@/lib/api/auth";
import { Logo } from "@/components/shared/Logo";

interface SavedAccount {
  name: string;
  email: string;
  avatarLetter: string;
  avatarBg: string;
}

function GoogleChooserContent() {
  const searchParams = useSearchParams();
  const providerParam = (searchParams.get("provider") || "google").toLowerCase();
  const providerLabel = providerParam === "apple" ? "Apple" : providerParam === "facebook" ? "Facebook" : "Google";

  // Steps: choose -> confirm -> check_email -> custom_input
  const [step, setStep] = useState<"choose" | "confirm" | "check_email" | "custom_input">("choose");
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isConfirmedByMail, setIsConfirmedByMail] = useState(false);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [isDirectConfirming, setIsDirectConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Sign in - ${providerLabel} Accounts`;
  }, [providerLabel]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Listen for confirmation broadcast from other tab/window when user clicks link in Gmail
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("quickpdf_auth");
      channel.onmessage = (event) => {
        if (event.data?.type === "OAUTH_SUCCESS") {
          setIsConfirmedByMail(true);
          if (window.opener) {
            window.opener.postMessage(event.data, "*");
          }
          setTimeout(() => {
            window.close();
          }, 800);
        }
      };
    } catch {
      // Ignore if not supported
    }

    return () => {
      channel?.close();
    };
  }, []);

  // Poll backend when on "check_email" step to auto-detect confirmation
  useEffect(() => {
    if (step !== "check_email" || !selectedAccount || isConfirmedByMail) return;

    const interval = setInterval(async () => {
      try {
        const res = await checkConfirmStatus(selectedAccount.email);
        if (res.confirmed && res.session) {
          setIsConfirmedByMail(true);
          if (window.opener) {
            window.opener.postMessage(
              {
                type: "OAUTH_SUCCESS",
                token: res.session.token,
                user: res.session.user,
              },
              "*"
            );
          }
          setTimeout(() => {
            window.close();
          }, 700);
        }
      } catch {
        // Polling retry
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [step, selectedAccount, isConfirmedByMail]);

  // Exact Google accounts as in user's reference screenshot
  const googleAccounts: SavedAccount[] = [
    {
      name: "Samir A",
      email: "wpssamiransari@gmail.com",
      avatarLetter: "S",
      avatarBg: "bg-[#546E7A]", // Slate / Grey-blue
    },
    {
      name: "Samir Ansari",
      email: "wpssamir@gmail.com",
      avatarLetter: "S",
      avatarBg: "bg-[#C2185B]", // Magenta / Pink
    },
    {
      name: "Samir Ansari",
      email: "samir939415@gmail.com",
      avatarLetter: "S",
      avatarBg: "bg-[#E65100]", // Orange
    },
    {
      name: "Samir Ansari",
      email: "pdfplatform382@gmail.com",
      avatarLetter: "S",
      avatarBg: "bg-[#5C2D91]", // Purple
    },
  ];

  const handleAccountClick = async (account: SavedAccount) => {
    setSelectedAccount(account);
    setError(null);
    setIsSendingCode(true);
    setStep("check_email");

    try {
      const res = await sendSocialConfirmationCode({
        email: account.email,
        name: account.name,
        provider: providerParam as "google" | "apple" | "facebook",
      });

      if (res.confirmUrl) {
        setConfirmUrl(res.confirmUrl);
      }
      setResendCooldown(res.cooldownSeconds || 30);
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch confirmation email.");
      setStep("choose");
    } finally {
      setIsSendingCode(false);
    }
  };

  // Dispatches confirmation email to user's Google account
  const handleSendConfirmationEmail = async () => {
    if (!selectedAccount) return;

    setIsSendingCode(true);
    setError(null);

    try {
      const res = await sendSocialConfirmationCode({
        email: selectedAccount.email,
        name: selectedAccount.name,
        provider: providerParam as "google" | "apple" | "facebook",
      });

      if (res.confirmUrl) {
        setConfirmUrl(res.confirmUrl);
      }
      setResendCooldown(res.cooldownSeconds || 30);
      setStep("check_email");
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch confirmation email.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleDirectConfirm = async () => {
    if (!confirmUrl && !selectedAccount) return;
    setIsDirectConfirming(true);
    try {
      const url = new URL(confirmUrl || window.location.href);
      const token = url.searchParams.get("token");
      const email = url.searchParams.get("email") || selectedAccount?.email;
      if (token && email) {
        const { confirmLoginWithToken } = await import("@/lib/api/auth");
        const res = await confirmLoginWithToken({ email, token });
        setIsConfirmedByMail(true);
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "OAUTH_SUCCESS",
              token: res.token,
              user: res.user,
            },
            "*"
          );
        }
        setTimeout(() => {
          window.close();
        }, 800);
      } else if (confirmUrl) {
        window.location.href = confirmUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to confirm sign-in directly.");
    } finally {
      setIsDirectConfirming(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    const name = customName.trim() || customEmail.split("@")[0];
    const newAccount: SavedAccount = {
      name,
      email: customEmail.trim().toLowerCase(),
      avatarLetter: name.charAt(0).toUpperCase() || "U",
      avatarBg: "bg-[#1A73E8]",
    };

    setSelectedAccount(newAccount);
    setStep("confirm");
  };

  const handleCancel = () => {
    if (step === "confirm" || step === "custom_input" || step === "check_email") {
      setStep("choose");
      setError(null);
      return;
    }
    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage({ type: "OAUTH_CANCEL" }, "*");
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-[#131314] text-[#E3E3E3] flex flex-col justify-between selection:bg-[#A8C7FA] selection:text-[#041E49]">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-[#2C2D30] flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          {providerLabel === "Google" && (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span className="text-[14px] font-medium text-[#E3E3E3]">
            Sign in with {providerLabel}
          </span>
        </div>
      </div>

      {/* Progress indicator during network calls */}
      {isSendingCode && (
        <div className="w-full h-1 bg-[#1E1F20] overflow-hidden">
          <div className="h-full bg-[#A8C7FA] animate-[indeterminate_1.2s_infinite_linear]" />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-6 max-w-xl mx-auto w-full">
        {/* ========================================================================= */}
        {/* STEP 1: CHOOSE AN ACCOUNT (Matching user screenshot)                      */}
        {/* ========================================================================= */}
        {step === "choose" && (
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0">
                <Logo className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-normal text-[#E3E3E3] tracking-tight">
                  Choose an account
                </h1>
                <p className="text-sm text-[#C4C7C5] mt-0.5">
                  to continue to <span className="text-[#A8C7FA] font-medium">QuickPDF</span>
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-xs font-medium text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col w-full divide-y divide-[#2C2D30] border-y border-[#2C2D30]">
              {googleAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleAccountClick(account)}
                  className="w-full flex items-center gap-4 py-3.5 px-3 rounded-xl hover:bg-[#1E1F20] transition-colors text-left group cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-full ${account.avatarBg} text-white font-medium flex items-center justify-center text-sm shrink-0`}
                  >
                    {account.avatarLetter}
                  </div>
                  <div className="flex flex-col overflow-hidden pr-2">
                    <span className="text-[14px] font-medium text-[#E3E3E3] group-hover:text-white truncate">
                      {account.name}
                    </span>
                    <span className="text-[12px] text-[#9AA0A6] truncate">
                      {account.email}
                    </span>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("custom_input");
                }}
                className="w-full flex items-center gap-4 py-3.5 px-3 rounded-xl hover:bg-[#1E1F20] transition-colors text-left group cursor-pointer"
              >
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                  <svg
                    className="w-6 h-6 text-[#C4C7C5]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <span className="text-[14px] font-medium text-[#E3E3E3] group-hover:text-white">
                  Use another account
                </span>
              </button>
            </div>

            <div className="mt-8 text-[12px] text-[#9AA0A6] leading-relaxed">
              Before using this app, you can review QuickPDF&apos;s{" "}
              <a href="/privacy" target="_blank" className="text-[#A8C7FA] hover:underline font-medium">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" target="_blank" className="text-[#A8C7FA] hover:underline font-medium">
                Terms of Service
              </a>
              .
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CONFIRMATION & DIRECT EMAIL CONFIRMATION BUTTON                   */}
        {/* ========================================================================= */}
        {step === "confirm" && selectedAccount && (
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0">
                <Logo className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-normal text-[#E3E3E3] tracking-tight">
                  Sign in to QuickPDF
                </h2>
                <p className="text-xs text-[#9AA0A6] mt-0.5">
                  google.com verification
                </p>
              </div>
            </div>

            <div
              onClick={() => setStep("choose")}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#1E1F20] border border-[#3C4043] hover:border-[#5F6368] transition-all cursor-pointer mb-6 group"
              title="Click to switch account"
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div
                  className={`w-9 h-9 rounded-full ${selectedAccount.avatarBg} text-white font-medium flex items-center justify-center text-sm shrink-0`}
                >
                  {selectedAccount.avatarLetter}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-[14px] font-medium text-[#E3E3E3] group-hover:text-white truncate">
                    {selectedAccount.name}
                  </span>
                  <span className="text-[12px] text-[#9AA0A6] truncate">
                    {selectedAccount.email}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#A8C7FA] font-medium shrink-0 pl-2">
                <span>Change</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="bg-[#18191B] rounded-2xl p-5 border border-[#2C2D30] mb-6 space-y-4">
              <p className="text-[13px] text-[#C4C7C5] leading-relaxed">
                QuickPDF will send a 1-click confirmation link directly to{" "}
                <span className="font-semibold text-white">{selectedAccount.email}</span>.
              </p>

              <div className="pt-2 border-t border-[#2C2D30] space-y-2.5">
                <div className="flex items-start gap-2.5 text-xs text-[#9AA0A6]">
                  <Mail className="w-4 h-4 text-[#A8C7FA] shrink-0 mt-0.5" />
                  <span>Open your Gmail and click the confirmation button to sign in directly.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#9AA0A6]">
                  <ShieldCheck className="w-4 h-4 text-[#A8C7FA] shrink-0 mt-0.5" />
                  <span>No password needed. Verified securely through your Google Account.</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-xs font-medium text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2C2D30]">
              <button
                type="button"
                disabled={isSendingCode}
                onClick={handleCancel}
                className="px-6 py-2.5 rounded-full text-xs font-medium text-[#A8C7FA] hover:bg-[#1E1F20] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSendingCode}
                onClick={handleSendConfirmationEmail}
                className="px-7 py-2.5 rounded-full bg-[#A8C7FA] text-[#041E49] hover:bg-[#8AB4F8] font-medium text-xs transition-all shadow-sm flex items-center gap-2 disabled:opacity-70 cursor-pointer"
              >
                {isSendingCode ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#041E49]/30 border-t-[#041E49] rounded-full animate-spin" />
                    <span>Sending email to Gmail...</span>
                  </>
                ) : (
                  <span>Send Confirmation Email</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: CHECK YOUR GMAIL (DIRECT CONFIRMATION NOTICE & AUTO-POLLER)       */}
        {/* ========================================================================= */}
        {step === "check_email" && selectedAccount && (
          <div className="flex flex-col w-full text-center items-center py-4">
            {isConfirmedByMail ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-5 animate-in zoom-in-75 duration-300">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-normal text-white mb-2">
                  Confirmed from Gmail!
                </h2>
                <p className="text-sm text-[#A8C7FA]">
                  Logging you in to QuickPDF...
                </p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-[#1E1F20] border border-[#3C4043] flex items-center justify-center text-[#A8C7FA] mb-5 relative">
                  <Mail className="w-8 h-8" />
                  <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[#A8C7FA] animate-ping" />
                </div>

                <h2 className="text-2xl font-normal text-[#E3E3E3] tracking-tight mb-2">
                  Check your Gmail
                </h2>

                <p className="text-sm text-[#C4C7C5] max-w-md mx-auto leading-relaxed mb-4">
                  We sent a confirmation link to{" "}
                  <span className="font-semibold text-white">{selectedAccount.email}</span>.
                  Open the email and click the confirmation button to sign in directly.
                </p>

                {/* Spam/Promotions folder advice */}
                <div className="w-full max-w-md bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-left mb-5 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/90 leading-relaxed">
                    <span className="font-semibold text-amber-300">Don&apos;t see the email?</span> Check your{" "}
                    <span className="font-semibold text-white">Spam / Junk</span> or{" "}
                    <span className="font-semibold text-white">Promotions</span> folder, or use the direct button below.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mb-6">
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2C2D30] hover:bg-[#3C4043] text-white font-medium text-xs sm:text-sm transition-all border border-[#444746]"
                  >
                    <span>Open Gmail Inbox</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {confirmUrl && (
                    <button
                      type="button"
                      disabled={isDirectConfirming}
                      onClick={handleDirectConfirm}
                      className="w-full flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#A8C7FA] text-[#041E49] hover:bg-[#8AB4F8] font-bold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:opacity-70"
                    >
                      {isDirectConfirming ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#041E49]/30 border-t-[#041E49] rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#041E49]" />
                      )}
                      <span>Confirm & Sign In Directly</span>
                    </button>
                  )}
                </div>

                {/* Polling status notice */}
                <div className="flex items-center gap-2 text-xs text-[#9AA0A6] mb-8">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#A8C7FA] animate-pulse" />
                  <span>Waiting for you to click confirmation in Gmail...</span>
                </div>

                <div className="flex items-center justify-between w-full max-w-sm border-t border-[#2C2D30] pt-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    className="text-[#9AA0A6] hover:text-white transition-colors"
                  >
                    Change account
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isSendingCode}
                    onClick={handleSendConfirmationEmail}
                    className="font-medium text-[#A8C7FA] hover:underline disabled:text-[#5F6368] disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend confirmation email"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: CUSTOM EMAIL INPUT                                                */}
        {/* ========================================================================= */}
        {step === "custom_input" && (
          <div className="flex flex-col w-full">
            <form onSubmit={handleCustomSubmit} className="flex flex-col space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="p-1.5 rounded-full hover:bg-[#1E1F20] text-[#9AA0A6] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-lg font-normal text-[#E3E3E3]">
                  Sign in with your Google Account
                </h3>
              </div>

              <div>
                <label className="block text-xs text-[#9AA0A6] mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Samir Ansari"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full rounded-lg bg-[#1E1F20] border border-[#5F6368] px-3.5 py-3 text-sm text-[#E3E3E3] placeholder-[#9AA0A6] focus:outline-none focus:border-[#A8C7FA] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9AA0A6] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full rounded-lg bg-[#1E1F20] border border-[#5F6368] px-3.5 py-3 text-sm text-[#E3E3E3] placeholder-[#9AA0A6] focus:outline-none focus:border-[#A8C7FA] transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#2C2D30]">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="px-4 py-2 text-xs font-medium text-[#A8C7FA] hover:bg-[#1E1F20] rounded-full transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#A8C7FA] text-[#041E49] font-medium text-xs hover:bg-[#8AB4F8] transition-colors"
                >
                  Next
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div className="px-6 py-4 border-t border-[#2C2D30] flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#9AA0A6] gap-3 select-none">
        <div className="flex items-center gap-1 hover:text-white cursor-pointer transition-colors">
          <span>English (United States)</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-white transition-colors">Help</a>
          <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms</a>
        </div>
      </div>
    </div>
  );
}

export default function GoogleChooserPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#131314]" />}>
      <GoogleChooserContent />
    </Suspense>
  );
}
