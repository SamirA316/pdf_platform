import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Scale, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative py-16 lg:py-24">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[900px] relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-[52px] font-bold text-[#33333B] tracking-tight mb-4 leading-tight">
              Terms of Service
            </h1>
            <p className="text-lg text-[#4A4A55] font-medium">Last updated: September 2026</p>
          </div>

          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">

            <div className="flex items-center gap-6 mb-10 pb-10 border-b border-gray-100">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                <FileText className="w-7 h-7" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#33333B]">Terms of Use</h2>
                <p className="text-[#4A4A55] font-medium mt-1">Please read these terms carefully before using our services.</p>
              </div>
            </div>

            <div className="space-y-10 text-[#4A4A55] leading-relaxed text-[16px] font-medium">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">1</span>
                  Agreement to Terms
                </h2>
                <p className="pl-11">
                  These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity (&quot;you&quot;) and QuickPDF (&quot;we,&quot; &quot;us&quot; or &quot;our&quot;), concerning your access to and use of our website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">2</span>
                  Intellectual Property Rights
                </h2>
                <p className="pl-11">
                  Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the &quot;Content&quot;) and the trademarks, service marks, and logos contained therein are owned or controlled by us or licensed to us.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">3</span>
                  User Representations
                </h2>
                <p className="pl-11">By using the Site, you represent and warrant that:</p>
                <ul className="list-disc pl-16 mt-2 space-y-3">
                  <li>All registration information you submit will be true, accurate, current, and complete.</li>
                  <li>You will maintain the accuracy of such information and promptly update such registration information as necessary.</li>
                  <li>You have the legal capacity and you agree to comply with these Terms of Service.</li>
                  <li>You will not use the Site for any illegal or unauthorized purpose.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">4</span>
                  Prohibited Activities
                </h2>
                <p className="pl-11">You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-[#33333B]">Questions?</h2>
                <p>
                  If you have questions or comments about these Terms, please contact us at: <a href="mailto:legal@quickpdf.com" className="text-[#E5322D] font-bold hover:underline transition-colors">legal@quickpdf.com</a>
                </p>
              </section>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
