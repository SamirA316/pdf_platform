"use client";

import { useState } from "react";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ToolCard } from "@/components/shared/ToolCard";
import { Button } from "@/components/ui/button";
import {
  Monitor, Smartphone, Briefcase, CheckCircle2, Crown, Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { getToolsByFilter } from "@/config/tools";

const filters = ['All', 'Workflows', 'Organize PDF', 'Optimize PDF', 'Convert PDF', 'Edit PDF', 'PDF Security', 'PDF Intelligence'];

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredTools = getToolsByFilter(activeFilter);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      {/* Decorative Background blob */}
      <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

      <Navbar />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-4 leading-tight">
            Every tool you need to work with PDFs
          </h1>
          <p className="text-lg md:text-xl text-[#4A4A55] mb-6 max-w-3xl mx-auto font-medium">
            Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks. Secure and fast processing.
          </p>
        </section>

        {/* Filters */}
        <section id="tools" className="px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full mb-8">
          <div className="flex justify-start md:justify-center w-full relative">
            {/* Fade edges for mobile scrolling */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#FDFDFD] to-transparent z-10 md:hidden pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#FDFDFD] to-transparent z-10 md:hidden pointer-events-none" />
            
            <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-2 md:gap-3 pb-2 w-full md:w-max md:max-w-full px-2 scroll-smooth">
              {filters.map((filter) => {
                const count = getToolsByFilter(filter).length;
                const isActive = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`relative px-5 py-2.5 rounded-2xl text-[14px] font-bold transition-all duration-300 shrink-0 whitespace-nowrap overflow-hidden group ${
                      isActive
                        ? 'bg-[#E5322D] text-white shadow-md'
                        : 'bg-white text-[#4A4A55] border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Active State Background Animation */}
                    {isActive && (
                      <span className="absolute inset-0 bg-black/10 rounded-2xl opacity-0 hover:opacity-100 transition-opacity" />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {filter}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}`}>
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* TOOLS GRID */}
        <section className="pb-12 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto min-h-[500px]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.title}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                href={`/tools/${tool.slug}`}
                color={tool.color}
                bgColor={tool.bgColor}
                badge={tool.badge}
              />
            ))}
          </div>
          {filteredTools.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              No tools found in this category.
            </div>
          )}
        </section>

        {/* WORK YOUR WAY SECTION */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 text-center bg-[#FAFAFA] border-t border-gray-100">
          <h2 className="text-4xl font-bold tracking-tight text-[#33333B] mb-10">Work your way</h2>

          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {/* Desktop */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="h-48 bg-[#FDEFEF] relative overflow-hidden flex items-end justify-center pt-8 px-8">
                <div className="bg-white w-full h-full rounded-t-lg shadow-sm border border-b-0 border-gray-200 flex items-center justify-center">
                  <Monitor className="w-16 h-16 text-red-300" strokeWidth={1} />
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-3 text-[#33333B]">Seamless Desktop App</h3>
                <p className="text-[#4A4A55] mb-6 flex-1 text-sm leading-relaxed">
                  Process files directly on your computer. Enjoy unlimited batch processing without needing an internet connection.
                </p>
                <Link href="/desktop" className="self-end text-[#33333B] hover:text-red-500 transition-colors">
                  <span className="sr-only">Go to Desktop</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </Link>
              </div>
            </div>

            {/* Mobile */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="h-48 bg-[#FDEFEF] relative overflow-hidden flex items-end justify-center pt-8 px-16">
                <div className="bg-white w-full h-full rounded-t-3xl shadow-sm border border-b-0 border-gray-200 flex items-center justify-center">
                  <Smartphone className="w-16 h-16 text-red-300" strokeWidth={1} />
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-3 text-[#33333B]">Powerful Mobile Experience</h3>
                <p className="text-[#4A4A55] mb-6 flex-1 text-sm leading-relaxed">
                  Edit and convert documents right from your smartphone. Your essential PDF toolkit travels with you.
                </p>
                <Link href="/mobile" className="self-end text-[#33333B] hover:text-red-500 transition-colors">
                  <span className="sr-only">Go to Mobile</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </Link>
              </div>
            </div>

            {/* Business */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="h-48 bg-[#FDEFEF] relative overflow-hidden flex items-end justify-center pt-8 px-8">
                <div className="bg-white w-full h-full rounded-t-lg shadow-sm border border-b-0 border-gray-200 flex items-center justify-center relative">
                  <div className="absolute top-4 left-4 right-4 flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100" />
                    <div className="w-6 h-6 rounded-full bg-red-100" />
                    <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-600">+</div>
                  </div>
                  <Briefcase className="w-16 h-16 text-red-300 mt-8" strokeWidth={1} />
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-3 text-[#33333B]">Enterprise Solutions</h3>
                <p className="text-[#4A4A55] mb-6 flex-1 text-sm leading-relaxed">
                  Streamline your company&apos;s document workflow. Secure, scalable plans designed for teams of any size.
                </p>
                <Link href="/business" className="self-end text-red-500 hover:text-red-600 transition-colors">
                  <span className="sr-only">Go to Business</span>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* PREMIUM SECTION */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto">
          <div className="bg-[#FFF8E6] rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
            <div className="flex-1 z-10">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#33333B] mb-8 leading-tight">
                Unlock Pro Features
              </h2>

              <ul className="space-y-6 mb-10 text-[#4A4A55] text-lg">
                <li className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mr-4 shrink-0 mt-0.5" strokeWidth={2} />
                  <span>Enjoy unlimited daily tasks, larger file sizes, and priority processing speed.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mr-4 shrink-0 mt-0.5" strokeWidth={2} />
                  <span>Get advanced OCR capabilities to extract text from scanned documents accurately.</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mr-4 shrink-0 mt-0.5" strokeWidth={2} />
                  <span>Go ad-free and access our dedicated desktop application for offline work.</span>
                </li>
              </ul>

              <Button className="bg-[#FFC436] hover:bg-[#F2B625] text-black font-bold text-lg px-8 py-6 rounded-lg flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Get Premium
              </Button>
            </div>

            <div className="flex-1 relative w-full h-[300px] md:h-[400px] z-10 flex items-center justify-center">
              {/* Abstract placeholder for the premium illustration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-80 bg-white rounded-xl shadow-xl border border-gray-100 z-20 flex flex-col p-4 transform rotate-2">
                <div className="h-6 w-3/4 bg-gray-200 rounded mb-4" />
                <div className="h-40 w-full bg-gray-100 rounded mb-4 flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12" />
                </div>
                <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                <div className="h-4 w-5/6 bg-gray-200 rounded" />
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-red-400 rounded-3xl -z-10 transform -translate-x-8 translate-y-8" />

              <div className="absolute bottom-0 right-0 w-48 h-40 bg-gray-200 rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
                <div className="w-full h-full bg-[#E5E7EB] flex items-end justify-center opacity-80">
                  {/* Placeholder for people image */}
                  <div className="flex -mb-4">
                    <div className="w-12 h-16 bg-gray-400 rounded-t-full mx-1" />
                    <div className="w-12 h-16 bg-gray-500 rounded-t-full mx-1" />
                    <div className="w-12 h-16 bg-gray-600 rounded-t-full mx-1" />
                  </div>
                </div>
              </div>

              <div className="absolute top-8 left-8 w-16 h-16 bg-[#FFC436]/40 rounded-full flex items-center justify-center blur-sm z-30">
                <Crown className="w-8 h-8 text-[#D9A321]" />
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA SECTION */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden mt-8 bg-[#0F172A]">
          {/* Abstract background shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center z-10 relative">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
              Ready to simplify your document workflow?
            </h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-medium">
              Join thousands of users who trust our platform to manage, edit, and convert their PDFs securely and instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button className="bg-red-500 hover:bg-red-600 text-white font-bold text-lg px-10 py-7 rounded-full transition-all hover:scale-105 shadow-[0_0_40px_rgba(239,68,68,0.4)]">
                  Start for Free
                </Button>
              </Link>
              <Link href="#tools">
                <Button variant="outline" className="bg-transparent border-slate-700 text-white hover:bg-slate-800 hover:text-white font-bold text-lg px-10 py-7 rounded-full transition-all">
                  Explore All Tools
                </Button>
              </Link>
            </div>

            <p className="mt-8 text-sm text-slate-400 font-medium">
              Free to use • Secure local processing • No hidden fees
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
