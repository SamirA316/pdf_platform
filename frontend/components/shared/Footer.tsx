import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-6">
              <Logo className="w-[32px] h-[32px]" />
              <span className="font-extrabold text-[22px] tracking-tight text-[#33333B]">
                QuickPDF
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mt-4 max-w-xs">
              Fast, simple, and secure online workspace for working with PDFs and images.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/tools" className="hover:text-primary transition-colors">
                  PDF Tools
                </Link>
              </li>
              <li>
                <Link href="/image-tools" className="hover:text-primary transition-colors">
                  Image Tools
                </Link>
              </li>
              <li>
                <Link href="/ai-tools" className="hover:text-primary transition-colors">
                  AI Tools
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-primary transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/help" className="hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-primary transition-colors">
                  Guides
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} QuickPDF. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
