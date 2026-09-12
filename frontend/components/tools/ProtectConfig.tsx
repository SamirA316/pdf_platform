"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff } from "lucide-react";

interface ProtectConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function ProtectConfig({ files, onProcess }: ProtectConfigProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4 text-primary">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Secure your PDF</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">
          Set a Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-12"
            placeholder="Type your secure password"
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
          Keep this password safe. You will need it to open the file.
        </p>
      </div>

      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={() => onProcess({ password })} 
          className="w-full rounded-xl shadow-sm"
          disabled={!password || password.length < 3}
        >
          Protect Document
        </Button>
      </div>
    </div>
  );
}
