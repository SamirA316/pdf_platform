"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    let isValid = true;
    const newErrors = { email: "", password: "" };

    if (!formData.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      // Proceed with login logic here
      console.log("Login submitted:", formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="h-screen flex w-full bg-white overflow-hidden">
      {/* Left side: Premium Branding */}
      <div className="hidden lg:flex w-1/2 bg-[#0F172A] relative flex-col justify-between p-10 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-red-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 w-fit transition-transform hover:scale-105 duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5322D] text-white font-bold text-xl shadow-[0_0_20px_rgba(229,50,45,0.4)]">
              P
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              PDF Platform
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-bold text-white mb-6 leading-tight">
            Manage your documents with ease and security.
          </h1>
          <ul className="space-y-4 text-slate-300 text-base">
            <li className="flex items-center gap-3">
              <div className="bg-red-500/10 p-1 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-[#E5322D]" />
              </div>
              Unlimited document processing
            </li>
            <li className="flex items-center gap-3">
              <div className="bg-red-500/10 p-1 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-[#E5322D]" />
              </div>
              Bank-grade 256-bit encryption
            </li>
            <li className="flex items-center gap-3">
              <div className="bg-red-500/10 p-1 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-[#E5322D]" />
              </div>
              Access from any device
            </li>
          </ul>
        </div>

        <div className="relative z-10">
          <p className="text-slate-400 text-xs font-medium">
            © 2026 PDF Platform. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 lg:p-8 bg-[#F8FAFC] relative h-full overflow-hidden">
        {/* Subtle decorative background for mobile */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-full bg-gradient-to-b from-red-50/50 to-transparent pointer-events-none" />

        <div className="w-full max-w-md p-5 sm:p-6 border border-slate-400 rounded-[1.5rem] relative z-10 my-auto">
          
          <div className="mb-4 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5322D] text-white font-bold text-xl shadow-[0_0_15px_rgba(229,50,45,0.3)]">
                P
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#33333B]">
                PDF Platform
              </span>
            </div>
            
            <h2 className="text-2xl font-extrabold text-[#33333B] tracking-tight mb-1">
              Welcome back
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Please enter your details to sign in.
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#33333B] mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-[#33333B] placeholder-slate-400 focus:bg-white focus:outline-none transition-all duration-200 font-medium ${
                  errors.email 
                    ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20" 
                    : "border-slate-400 focus:border-black focus:ring-1 focus:ring-black"
                }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <div className="flex items-center gap-1.5 mt-1.5 text-red-500 text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.email}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#33333B] mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 pr-11 text-[#33333B] placeholder-slate-400 focus:bg-white focus:outline-none transition-all duration-200 font-medium ${
                    errors.password 
                      ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/20" 
                      : "border-slate-400 focus:border-black focus:ring-1 focus:ring-black"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center gap-1.5 mt-1.5 text-red-500 text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.password}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400 text-[#E5322D] focus:ring-[#E5322D] cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm font-bold text-slate-600 cursor-pointer select-none">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-bold text-[#E5322D] hover:text-[#CC2A26] transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold text-base h-11 transition-all hover:scale-[1.02] active:scale-[0.98]">
              Sign in
            </Button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-400" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-[#F8FAFC] px-4 text-slate-400 font-bold">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl bg-white border-slate-400 text-[#33333B] h-12 hover:bg-slate-50 hover:border-black transition-all shadow-sm flex items-center justify-center" aria-label="Continue with Google">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl bg-white border-slate-400 text-[#33333B] h-12 hover:bg-slate-50 hover:border-black transition-all shadow-sm flex items-center justify-center" aria-label="Continue with Apple">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.15 2.95.93 3.67 2.14-3.16 1.83-2.61 6.13.56 7.39-.77 1.86-1.68 3.59-2.88 3.48zm-3.66-14.7c.07-2.18 1.85-4.04 4.02-4.08.28 2.33-1.64 4.38-4.02 4.08z" />
                </svg>
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl bg-white border-slate-400 text-[#33333B] h-12 hover:bg-slate-50 hover:border-black transition-all shadow-sm flex items-center justify-center" aria-label="Continue with Facebook">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
                </svg>
              </Button>
            </div>
          </div>
          
          <p className="mt-4 text-center text-sm text-slate-500 font-medium">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-bold text-[#E5322D] hover:text-[#CC2A26] transition-colors">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
