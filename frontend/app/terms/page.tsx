import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative py-16 lg:py-24">
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[900px] relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-[52px] font-bold text-[#33333B] tracking-tight mb-4 leading-tight">
              Terms of Service
            </h1>
            <p className="text-lg text-[#4A4A55] font-medium">Last updated: September 2026 (Public Beta)</p>
          </div>

          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center gap-6 mb-10 pb-10 border-b border-gray-100">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                <FileText className="w-7 h-7" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#33333B]">Public Beta Terms of Use</h2>
                <p className="text-[#4A4A55] font-medium mt-1">Clear, fair, and transparent usage terms for QuickPDF.</p>
              </div>
            </div>

            <div className="space-y-10 text-[#4A4A55] leading-relaxed text-[16px] font-medium">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">1</span>
                  Acceptance of Terms
                </h2>
                <p className="pl-11">
                  By accessing or using QuickPDF, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you must discontinue using our services.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">2</span>
                  Service Availability & Beta Tier
                </h2>
                <p className="pl-11">
                  QuickPDF is currently available in Public Beta. All 12 Core PDF Tools are available free of charge (₹0). We provide a single upload limit of up to 50 MB per file, and a total account storage capacity of 100 MB. We reserve the right to modify resource limits or institute paid subscriptions with prior notice to users.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">3</span>
                  Ownership of Content
                </h2>
                <p className="pl-11">
                  You retain 100% intellectual property ownership of all documents, files, and data uploaded or generated using QuickPDF. QuickPDF claims no ownership or proprietary rights over any user content.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">4</span>
                  Acceptable Use Policy
                </h2>
                <p className="pl-11">
                  You agree not to use the service for uploading malicious code, viruses, or illegal material, or attempting to compromise platform security, reverse engineer backend systems, or bypass quota and rate limits.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-[#33333B]">Legal Inquiries</h2>
                <p>
                  Questions about our Terms of Service should be sent to:{" "}
                  <a href="mailto:support@quickpdf.local" className="text-[#E5322D] font-bold hover:underline transition-colors">
                    support@quickpdf.local
                  </a>
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
