import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ShieldCheck, Lock } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative py-16 lg:py-24">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[900px] relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-[52px] font-bold text-[#33333B] tracking-tight mb-4 leading-tight">
              Privacy Policy
            </h1>
            <p className="text-lg text-[#4A4A55] font-medium">Last updated: September 2026</p>
          </div>

          <div className="bg-white p-8 md:p-12 lg:p-16 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">

            <div className="flex items-center gap-6 mb-10 pb-10 border-b border-gray-100">
              <div className="w-14 h-14 bg-red-50 text-[#E5322D] rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#33333B]">Commitment to Privacy</h2>
                <p className="text-[#4A4A55] font-medium mt-1">We believe privacy is a fundamental human right.</p>
              </div>
            </div>

            <div className="space-y-10 text-[#4A4A55] leading-relaxed text-[16px] font-medium">
              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">1</span>
                  Introduction
                </h2>
                <p className="pl-11">
                  At QuickPDF, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">2</span>
                  Document Processing
                </h2>
                <p className="pl-11">
                  When you use our PDF tools, the documents you upload are processed securely on our servers. We employ industry-standard encryption during transit and processing. <strong className="text-[#33333B]">We do not read, analyze, or use the content of your documents for any purpose other than fulfilling your requested tool action.</strong> All uploaded and processed files are automatically and permanently deleted from our servers within a short period after processing (typically within 1 hour).
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">3</span>
                  Information We Collect
                </h2>
                <p className="pl-11">We may collect information about you in a variety of ways. The information we may collect on the Site includes:</p>
                <ul className="list-disc pl-16 mt-2 space-y-3">
                  <li><strong className="text-[#33333B]">Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number, that you voluntarily give to us when you register.</li>
                  <li><strong className="text-[#33333B]">Derivative Data:</strong> Information our servers automatically collect when you access the Site, such as your IP address, your browser type, your operating system, and your access times.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-bold text-[#33333B] flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-[#33333B] text-sm flex items-center justify-center shrink-0">4</span>
                  Use of Your Information
                </h2>
                <p className="pl-11">Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:</p>
                <ul className="list-disc pl-16 mt-2 space-y-3">
                  <li>Create and manage your account.</li>
                  <li>Deliver targeted advertising, coupons, newsletters, and other information regarding promotions.</li>
                  <li>Email you regarding your account or order.</li>
                  <li>Increase the efficiency and operation of the Site.</li>
                </ul>
              </section>

              <section className="space-y-4 pt-6 border-t border-gray-100">
                <h2 className="text-2xl font-bold text-[#33333B]">Questions?</h2>
                <p>
                  If you have questions or comments about this Privacy Policy, please contact our Data Protection Officer at: <a href="mailto:privacy@quickpdf.com" className="text-[#E5322D] font-bold hover:underline transition-colors">privacy@quickpdf.com</a>
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
