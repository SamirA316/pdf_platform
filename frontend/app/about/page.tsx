import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Shield, Zap, Heart, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-6 leading-tight">
            Reimagining how the world <br className="hidden md:block" />
            <span className="text-[#E5322D]">interacts with PDFs</span>
          </h1>

          <p className="text-lg md:text-xl text-[#4A4A55] mb-10 max-w-3xl mx-auto font-medium leading-relaxed">
            QuickPDF was founded on a simple belief: managing documents shouldn&apos;t be a chore. We combine cutting-edge technology with beautiful design to give you superpowers without the bloatware or hidden fees.
          </p>
        </section>

        {/* Floating Stats Card */}
        <section className="px-4 sm:px-6 lg:px-8 mb-24 max-w-[1200px] mx-auto">
          <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="flex flex-col items-center py-4 md:py-0">
                <div className="text-5xl font-bold text-[#33333B] mb-2">1M+</div>
                <div className="text-[15px] font-semibold text-[#4A4A55]">Files Processed</div>
              </div>
              <div className="flex flex-col items-center py-4 md:py-0">
                <div className="text-5xl font-bold text-[#33333B] mb-2">100%</div>
                <div className="text-[15px] font-semibold text-[#4A4A55]">Secure & Private</div>
              </div>
              <div className="flex flex-col items-center py-4 md:py-0">
                <div className="text-5xl font-bold text-[#33333B] mb-2">24/7</div>
                <div className="text-[15px] font-semibold text-[#4A4A55]">Availability</div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 bg-[#FAFAFA] border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[1200px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-[#33333B] mb-6 leading-tight">
                  Engineered for <span className="text-[#E5322D]">speed and security</span>
                </h2>
                <p className="text-lg text-[#4A4A55] leading-relaxed mb-8 font-medium">
                  We don&apos;t compromise. Every tool is built from the ground up to ensure your files are processed instantly while maintaining strict military-grade encryption standards.
                </p>
                <ul className="space-y-4">
                  {[
                    "Files are auto-deleted after 1 hour",
                    "End-to-end 256-bit encryption",
                    "No watermarks or hidden limits",
                    "Cloud-powered processing engine"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] font-semibold text-[#33333B]">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-14 h-14 bg-red-50 text-[#E5322D] rounded-xl flex items-center justify-center mb-6">
                    <Shield className="w-7 h-7" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-3">Privacy First</h3>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed flex-1">
                    Your documents belong to you. We process files securely and automatically delete them from our servers shortly after processing.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300 sm:translate-y-6">
                  <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-6">
                    <Zap className="w-7 h-7" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-3">Lightning Fast</h3>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed flex-1">
                    Time is your most valuable asset. Our infrastructure is optimized to perform complex PDF operations in milliseconds.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300 sm:col-span-2 md:col-span-1 md:col-start-2">
                  <div className="w-14 h-14 bg-green-50 text-green-500 rounded-xl flex items-center justify-center mb-6">
                    <Heart className="w-7 h-7" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-3">User Centric</h3>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed flex-1">
                    We design with you in mind. No confusing menus or cluttered interfaces—just a clean, intuitive experience every time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION (Matching Homepage) */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[#0F172A]">
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center z-10 relative">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6 leading-tight">
              Ready to simplify your workflow?
            </h2>
            <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-medium">
              Join thousands of users who trust our platform to manage, edit, and convert their PDFs securely and instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button className="bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold text-[15px] px-8 py-6 h-auto rounded-full shadow-[0_4px_14px_rgba(229,50,45,0.4)] transition-transform active:scale-95">
                  Create Free Account
                </Button>
              </Link>
              <Link href="/#tools">
                <Button variant="outline" className="bg-transparent border-slate-700 text-white hover:bg-slate-800 hover:text-white font-bold text-[15px] px-8 py-6 h-auto rounded-full transition-colors">
                  Explore All Tools
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
