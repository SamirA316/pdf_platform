"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
              P
            </div>
            <span className="inline-block font-bold text-xl tracking-tight text-foreground">
              PDF Platform
            </span>
          </Link>
          <nav className="hidden md:flex gap-6 items-center text-sm font-medium">
            <Link
              href="/tools"
              className="transition-colors hover:text-primary text-foreground/80"
            >
              PDF Tools
            </Link>
            <Link
              href="/image-tools"
              className="transition-colors hover:text-primary text-foreground/80"
            >
              Image Tools
            </Link>
            <Link
              href="/ai-tools"
              className="transition-colors hover:text-primary text-foreground/80"
            >
              AI Tools
            </Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-primary text-foreground/80"
            >
              Pricing
            </Link>
          </nav>
        </div>
        
        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-medium">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="font-medium rounded-full px-6">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-foreground hover:text-primary transition-colors p-2"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background absolute w-full left-0 top-16 shadow-lg pb-6">
          <div className="flex flex-col space-y-4 px-6 pt-4">
            <Link href="/tools" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground font-medium py-2">
              PDF Tools
            </Link>
            <Link href="/image-tools" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground font-medium py-2">
              Image Tools
            </Link>
            <Link href="/ai-tools" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground font-medium py-2">
              AI Tools
            </Link>
            <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground font-medium py-2">
              Pricing
            </Link>
            <div className="h-px bg-border/40 my-2"></div>
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground font-medium py-2">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full font-medium rounded-full mt-2">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
