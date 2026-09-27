import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative py-16 lg:py-24">
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[900px] relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-[52px] font-bold text-[#33333B] tracking-tight mb-4 leading-tight">
              Privacy Policy
            </h1>
            <p className="text-lg text-[#4A4A55] font-medium">Last updated: September 2026 (Public Beta)</p>
          </div>

          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">
            <div className="flex items-center gap-6 mb-10 pb-10 border-b border-gray-100">
              <div className="w-14 h-14 bg-red-50 text-[#E5322D] rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#33333B]">Strict Privacy & Zero Harvesting</h2>
                <p className="text-[#4A4A55] font-medium mt-1">Your documents are processed in isolation and remain strictly your property.</p>
              </div>
            </div>

            <div className="space-y-10 text-[#4A4A55] leading-relaxed text-[16px] font-medium">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">1</span>
                  Our Privacy Guarantee
                </h2>
                <p className="pl-11">
                  At QuickPDF, document security and privacy are fundamental engineering constraints. We do not inspect, mine, train AI models on, or resell the contents of your documents. All file transformations execute locally on secured worker infrastructure.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">2</span>
                  Document Storage & Retention
                </h2>
                <p className="pl-11">
                  When you upload files and execute jobs:
                </p>
                <ul className="list-disc pl-16 mt-2 space-y-2">
                  <li><strong className="text-[#33333B]">User-Owned Storage:</strong> Uploaded input files and processed output files are stored under your authenticated account workspace (up to the 100MB beta quota).</li>
                  <li><strong className="text-[#33333B]">Temporary Processor Files:</strong> All intermediate and scratch files created during PDF operations (e.g., merging, compressing, splitting) are automatically unlinked and permanently purged from server memory/temp disks immediately after job completion or failure.</li>
                  <li><strong className="text-[#33333B]">User-Controlled Deletion:</strong> You have full control to permanently delete any file from your dashboard at any time. When deleted, the physical file is unlinked immediately and your storage quota is instantaneously reclaimed.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">3</span>
                  Account & Data Deletion
                </h2>
                <p className="pl-11">
                  You can permanently delete your account directly through your Profile settings. Triggering account deletion immediately revokes all active authentication sessions, removes your database credentials, and unlinks all stored documents from disk storage.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">4</span>
                  No Third-Party Sharing
                </h2>
                <p className="pl-11">
                  We do not share, transmit, or expose your files to external third-party processors, advertisers, or third-party APIs during the operation of our 12 Core PDF Tools.
                </p>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-[#33333B]">Contact Us</h2>
                <p>
                  If you have privacy-related inquiries or security notices, reach out to our team at:{" "}
                  <a href="mailto:privacy@quickpdf.local" className="text-[#E5322D] font-bold hover:underline transition-colors">
                    privacy@quickpdf.local
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
