import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 bg-secondary/10">
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-16">
            Choose the perfect plan for your document needs. No hidden fees.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
            {/* Free Plan */}
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-6">₹0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-muted-foreground text-sm">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Basic PDF tools</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Basic Image tools</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Limited daily usage (5 files)</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Max file size: 100MB</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Standard processing speed</li>
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full rounded-full border-border">Get Started</Button>
              </Link>
            </div>
            
            {/* Pro Plan */}
            <div className="bg-primary/5 border-2 border-primary p-8 rounded-3xl shadow-md flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-full">RECOMMENDED</div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-6">₹199<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-foreground text-sm font-medium">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Everything in Free</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Unlimited daily usage</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Batch processing</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Max file size: 100MB</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Ad-free experience</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Priority processing</li>
              </ul>
              <Link href="/signup">
                <Button className="w-full rounded-full">Upgrade to Pro</Button>
              </Link>
            </div>
            
            {/* AI Pro Plan */}
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold mb-2">AI Pro</h3>
              <div className="text-4xl font-bold mb-6">₹399<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-muted-foreground text-sm">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Everything in Pro</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> AI PDF Summaries</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Chat with PDF (100 msgs/day)</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> AI Data Extraction</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> PDF Translation</li>
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="w-full rounded-full border-border">Get AI Pro</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
