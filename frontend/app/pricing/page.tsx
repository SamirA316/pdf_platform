import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 bg-secondary/10">
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" /> Public Beta Release
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Free During Beta
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-16">
            Full access to all 12 essential PDF manipulation tools with zero subscription fees during our public beta.
          </p>

          <div className="max-w-md mx-auto text-left">
            {/* Beta Edition Plan */}
            <div className="bg-card border-2 border-primary p-8 rounded-3xl shadow-lg flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-full">
                100% FREE
              </div>
              <h3 className="text-2xl font-bold mb-2">Beta Edition</h3>
              <p className="text-sm text-muted-foreground mb-6">Complete suite of 12 core PDF tools for personal and professional use.</p>
              <div className="text-5xl font-extrabold mb-8 text-foreground">
                ₹0<span className="text-lg text-muted-foreground font-normal"> / forever free</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1 text-foreground text-sm font-medium">
                <li className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>12 Core PDF Tools (Merge, Split, Compress, Rotate, etc.)</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>Up to 50MB single file upload limit</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>100MB persistent user storage quota</span>
                </li>
                <li className="flex items-center">
                  <ShieldCheck className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>Strict zero-leakage ownership & encrypted sessions</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>Batch processing and fast client streaming</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                  <span>No credit card or payment required</span>
                </li>
              </ul>
              <Link href="/signup">
                <Button className="w-full rounded-full py-6 text-base font-semibold">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
