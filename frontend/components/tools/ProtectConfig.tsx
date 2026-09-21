"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Printer,
  Copy,
  Edit3,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface ProtectConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
  slug?: string;
}

export function ProtectConfig({ files, onProcess, slug }: ProtectConfigProps) {
  const isUnlock = slug === "unlock-pdf";

  // Password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Permission toggles (for Protect mode)
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowModify, setAllowModify] = useState(false);
  const [allowAnnotate, setAllowAnnotate] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    if (!password.trim()) {
      setError("Please enter a password.");
      return;
    }

    if (isUnlock) {
      onProcess({ password: password.trim() });
    } else {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter.");
        return;
      }

      onProcess({
        userPassword: password.trim(),
        permissions: {
          print: allowPrint,
          copy: allowCopy,
          modify: allowModify,
          annotate: allowAnnotate,
        },
      });
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm transition-all">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          className={`inline-flex p-3 rounded-2xl mb-3 shadow-xs ${
            isUnlock
              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
              : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
          }`}
        >
          {isUnlock ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {isUnlock ? "Unlock Protected PDF" : "Password Protect PDF"}
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-md mx-auto">
          {isUnlock
            ? "Enter the known password to remove encryption and unlock the document."
            : "Encrypt your PDF with strong AES-256 password protection and customizable document permissions."}
        </p>
        {files[0] && (
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-muted/60 rounded-full text-xs font-medium text-foreground">
            <span className="truncate max-w-[260px] font-semibold">{files[0].name}</span>
            <span className="text-muted-foreground">
              ({(files[0].size / (1024 * 1024)).toFixed(2)} MB)
            </span>
          </div>
        )}
      </div>

      {/* Password Inputs */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-bold text-foreground mb-1.5">
            {isUnlock ? "Enter PDF Password" : "Set Document Password"}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-12 transition-all"
              placeholder={isUnlock ? "Enter password" : "Type strong password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!isUnlock && (
          <div>
            <label className="block text-sm font-bold text-foreground mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-12 transition-all"
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Permissions Checkboxes (Protect mode only) */}
      {!isUnlock && (
        <div className="mb-6 p-4 rounded-2xl bg-muted/30 border border-border/80">
          <label className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Document Permissions
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowPrint}
                onChange={(e) => setAllowPrint(e.target.checked)}
                className="w-4 h-4 rounded border-input text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              Allow Printing
            </label>

            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowCopy}
                onChange={(e) => setAllowCopy(e.target.checked)}
                className="w-4 h-4 rounded border-input text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              Allow Copying Content
            </label>

            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowModify}
                onChange={(e) => setAllowModify(e.target.checked)}
                className="w-4 h-4 rounded border-input text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              Allow Modifying Document
            </label>

            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowAnnotate}
                onChange={(e) => setAllowAnnotate(e.target.checked)}
                className="w-4 h-4 rounded border-input text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <FileCheck2 className="w-3.5 h-3.5 text-muted-foreground" />
              Allow Annotations & Forms
            </label>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleSubmit}
        className={`w-full h-12 rounded-xl font-bold text-base shadow-sm text-white flex items-center justify-center gap-2 transition-all cursor-pointer ${
          isUnlock
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        <span>{isUnlock ? "Unlock PDF" : "Encrypt & Protect PDF"}</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
