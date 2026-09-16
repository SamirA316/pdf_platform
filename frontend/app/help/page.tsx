import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Search, Book, User, CreditCard, Shield, FileText } from "lucide-react";

export default function HelpCenterPage() {
  const categories = [
    { title: "Getting Started", icon: Book, desc: "New to QuickPDF? Learn the basics." },
    { title: "Account", icon: User, desc: "Manage your profile and settings." },
    { title: "Billing & Plans", icon: CreditCard, desc: "Learn about subscriptions and payments." },
    { title: "Security", icon: Shield, desc: "Read about how we keep your data safe." },
    { title: "PDF Tools", icon: FileText, desc: "Troubleshoot issues with our core tools." },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-6 leading-tight">
            How can we help?
          </h1>

          <div className="relative max-w-2xl mx-auto mt-8">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-14 pr-6 py-5 rounded-3xl border-0 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.06)] text-lg text-[#33333B] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E5322D]/20 transition-all"
              placeholder="Search for articles, guides, and FAQs..."
            />
          </div>
        </section>

        {/* Categories Grid */}
        <section className="px-4 sm:px-6 lg:px-8 mb-24 max-w-[1200px] mx-auto pt-10">
          <h2 className="text-2xl font-bold text-[#33333B] mb-8 text-center">Browse by category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <div key={i} className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300 cursor-pointer">
                  <div className="w-12 h-12 bg-red-50 text-[#E5322D] rounded-xl flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-2">{cat.title}</h3>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 bg-[#FAFAFA] border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <h2 className="text-3xl font-bold text-[#33333B] mb-10 text-center">Frequently Asked Questions</h2>

            <div className="space-y-4">
              {[
                { q: "Is QuickPDF really free?", a: "Yes! Our core tools are 100% free to use. We also offer a Premium plan for power users who need higher file limits and priority processing." },
                { q: "Are my files secure?", a: "Absolutely. All files are uploaded over a secure, encrypted connection. We automatically delete your files from our servers 1 hour after processing." },
                { q: "What is the maximum file size?", a: "Free users can process files up to 50MB. Premium users enjoy a massive 2GB limit per file." },
                { q: "Can I use QuickPDF offline?", a: "Yes, we offer a dedicated desktop application for macOS and Windows that allows you to process PDFs without an internet connection." }
              ].map((faq, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100">
                  <h3 className="text-lg font-bold text-[#33333B] mb-2">{faq.q}</h3>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-[#4A4A55] font-medium mb-4">Still can&apos;t find what you&apos;re looking for?</p>
              <a href="/contact" className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white border border-gray-200 text-[#33333B] font-bold hover:bg-gray-50 hover:text-[#E5322D] transition-colors">
                Contact Support
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
