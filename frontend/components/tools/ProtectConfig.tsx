"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Eye, EyeOff } from "lucide-react";

interface ProtectConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
  slug?: string;
}

export function ProtectConfig({ files, onProcess, slug }: ProtectConfigProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isUnlock = slug === "unlock-pdf";

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className={`inline-flex p-3 rounded-full mb-4 ${isUnlock ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
          {isUnlock ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>
        <h3 className="text-2xl font-bold text-foreground">
          {isUnlock ? "Unlock your PDF" : "Secure your PDF"}
        </h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">
          {isUnlock ? "Enter PDF Password" : "Set a Password"}
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password.trim().length > 0) {
                onProcess({ password });
              }
            }}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-12"
            placeholder={isUnlock ? "Enter current password" : "Type your secure password"}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isUnlock 
            ? "Enter the document password to permanently remove its password protection."
            : "Keep this password safe. You will need it to open the file."}
        </p>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={() => onProcess({ password })} 
          className="w-full h-11 rounded-xl font-bold shadow-sm"
          disabled={!password || password.trim().length === 0}
        >
          {isUnlock ? "Unlock Document" : "Protect Document"}
        </Button>
      </div>
    </div>
  );
}

