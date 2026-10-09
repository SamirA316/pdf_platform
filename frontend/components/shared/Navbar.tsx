"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, CheckCircle2, LogOut as LogOutIcon } from "lucide-react";
import { tools, ToolMetadata } from "@/config/tools";
import { useSelector, useDispatch } from "react-redux";
import { checkAuth, logoutUser } from "@/store/slices/authSlice";
import { RootState, AppDispatch } from "@/store/store";
import { Logo } from "@/components/shared/Logo";

const getTools = (slugs: string[]) => slugs.map(s => tools.find(t => t.slug === s)).filter(Boolean) as ToolMetadata[];

const megaMenuColumns = [
  { title: "Organize PDF",    items: getTools(["merge-pdf", "split-pdf", "organize-pdf", "scan-to-pdf"]) },
  { title: "Optimize PDF",    items: getTools(["compress-pdf", "repair-pdf", "ocr-pdf"]) },
  { title: "Convert to PDF",  items: getTools(["jpg-to-pdf", "word-to-pdf", "powerpoint-to-pdf", "excel-to-pdf", "html-to-pdf"]) },
  { title: "Convert from PDF",items: getTools(["pdf-to-jpg", "pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "pdf-to-pdfa"]) },
  { title: "Edit PDF",        items: getTools(["rotate-pdf", "page-numbers", "watermark", "crop-pdf", "edit-pdf", "pdf-forms"]) },
  { title: "Security & AI",   items: getTools(["unlock-pdf", "protect-pdf", "sign-pdf", "redact-pdf", "compare-pdf", "ai-summarizer", "translate-pdf", "pdf-to-markdown"]) },
];

interface Toast { id: number; message: string; type: "login" | "logout" }

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading } = useSelector((state: RootState) => state.auth);
  const prevUserRef = useRef<typeof user>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { dispatch(checkAuth()); }, [dispatch]);

  const showToast = useCallback((message: string, type: "login" | "logout") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // Detect auth state transitions → toast
  useEffect(() => {
    if (prevUserRef.current === undefined) { prevUserRef.current = user; return; }
    if (!prevUserRef.current && user) showToast(`Welcome back, ${user.name?.split(" ")[0] || ""}! 👋`, "login");
    else if (prevUserRef.current && !user) showToast("Logged out successfully", "logout");
    prevUserRef.current = user;
  }, [user, showToast]);



  const logout = () => {
    dispatch(logoutUser());
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b border-[#E5E5E5]">
        <div className="container mx-auto flex h-[64px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8 relative">

          {/* Logo */}
          <div className="flex items-center h-full">
            <Link href="/" className="flex items-center gap-2.5 mr-6 xl:mr-10">
              <Logo className="w-[36px] h-[36px]" />
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#33333B]">QuickPDF</span>
            </Link>

            <nav className="hidden lg:flex items-center h-full text-[13px] font-bold text-[#33333B]">
              <Link href="/tools/merge-pdf"    className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">Merge PDF</Link>
              <Link href="/tools/split-pdf"    className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">Split PDF</Link>
              <Link href="/tools/compress-pdf" className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide">Compress PDF</Link>

              {/* Mega Menu */}
              <div className="h-full group">
                <button className="h-full flex items-center px-3 xl:px-4 hover:text-[#E5322D] transition-colors uppercase tracking-wide gap-1">
                  All PDF Tools <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:rotate-180 transition-transform duration-200" />
                </button>
                <div className="absolute top-[64px] left-0 w-full hidden group-hover:block bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)] border-b border-[#E5E5E5]">
                  <div className="max-w-[1400px] mx-auto p-8 lg:p-10">
                    <div className="grid grid-cols-6 gap-8">
                      {megaMenuColumns.map((col, idx) => (
                        <div key={idx} className="flex flex-col">
                          <h4 className="text-[#888888] text-[12px] mb-4 uppercase font-extrabold tracking-wider border-b border-[#F0F0F0] pb-2">{col.title}</h4>
                          <ul className="space-y-1">
                            {col.items.map((tool: ToolMetadata) => {
                              const Icon = tool.icon;
                              return (
                                <li key={tool.slug}>
                                  <Link href={`/tools/${tool.slug}`} className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group/item">
                                    <div className={`flex-shrink-0 ${tool.color}`}>
                                      <Icon className="w-4 h-4 opacity-90 group-hover/item:opacity-100 group-hover/item:scale-110 transition-all duration-200" strokeWidth={2} />
                                    </div>
                                    <span className="text-[13px] font-semibold text-[#4A4A55] group-hover/item:text-[#111111] transition-colors whitespace-nowrap">{tool.title}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </div>

          {/* Right: Auth (Commented out for now) */}
          {/*
          <div className="hidden lg:flex items-center h-full">
            {isLoading ? (
              <div className="w-20 h-5 bg-gray-100 animate-pulse rounded" />
            ) : user ? (
              <div key={`user-${user.id}`} className="auth-enter flex items-center gap-3">
                <span className="text-[14px] font-bold text-[#33333B] tracking-tight">
                  {user.name}
                </span>
                <button
                  onClick={logout}
                  className="h-9 px-4 rounded-lg border border-gray-200 text-[13px] font-bold text-gray-500 hover:border-[#E5322D] hover:text-[#E5322D] transition-all duration-200 active:scale-95"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div key="guest" className="auth-enter flex items-center">
                <Link href="/login" className="px-5 h-full flex items-center text-[14px] font-bold text-[#33333B] hover:text-[#E5322D] transition-colors">
                  Log in
                </Link>
                <Link href="/signup" className="ml-2">
                  <Button className="bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold rounded-lg px-7 h-10 text-[14px] shadow-[0_2px_10px_rgba(229,50,45,0.2)] transition-transform active:scale-95">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
          */}

          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center h-full">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-[#33333B]">
              {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white absolute w-full left-0 top-[64px] border-b border-[#E5E5E5] shadow-xl px-5 pt-2 pb-8 max-h-[calc(100vh-64px)] overflow-y-auto">
            <Link href="/tools/merge-pdf"    onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Merge PDF</Link>
            <Link href="/tools/split-pdf"    onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Split PDF</Link>
            <Link href="/tools/compress-pdf" onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">Compress PDF</Link>
            <Link href="/#tools"             onClick={() => setIsMobileMenuOpen(false)} className="block py-4 font-bold text-[#33333B] border-b border-[#F0F0F0] uppercase text-[14px] tracking-wide">All Tools</Link>
            {/* Auth options commented out for now
            <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-100">
              {user ? (
                <div className="auth-enter">
                  <div className="flex items-center gap-3 px-1 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#E5322D]/10 text-[#E5322D] font-black text-sm flex items-center justify-center">
                      {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-[#33333B]">{user.name}</p>
                      <p className="text-[12px] text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg font-semibold text-[13px] transition-colors"
                  >
                    <LogOutIcon className="w-4 h-4" /> Log out
                  </button>
                </div>
              ) : (
                <div className="auth-enter flex flex-col gap-3">
                  <Link href="/login"  onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center py-3.5 bg-[#F5F5F5] rounded-lg font-bold text-[#33333B]">Log in</Link>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center py-3.5 bg-[#E5322D] text-white rounded-lg font-bold">Sign up</Link>
                </div>
              )}
            </div>
            */}
          </div>
        )}
      </header>

      {/* Toast */}
      {toast && (
        <div
          key={toast.id}
          className={`auth-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg text-[13px] font-semibold pointer-events-none select-none whitespace-nowrap
            ${toast.type === "login" ? "bg-[#33333B] text-white" : "bg-gray-700 text-white"}`}
        >
          {toast.type === "login"
            ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <LogOutIcon   className="w-4 h-4 text-gray-300 flex-shrink-0" />
          }
          {toast.message}
        </div>
      )}
    </>
  );
}
