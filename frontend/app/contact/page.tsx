import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />

      <main className="flex-1 overflow-hidden relative">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 max-w-[1200px]">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-6 leading-tight">
              Get in touch
            </h1>
            <p className="text-lg md:text-xl text-[#4A4A55] mb-6 max-w-3xl mx-auto font-medium leading-relaxed">
              Have a question, feedback, or need help with a custom integration? We&apos;d love to hear from you. Our team usually replies within 24 hours.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">

            {/* Contact Info (Left Column) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex items-start gap-5 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 shrink-0 bg-red-50 text-[#E5322D] rounded-xl flex items-center justify-center mt-1">
                  <Mail className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-2">Email Us</h3>
                  <p className="text-[#4A4A55] text-[15px] mb-4 leading-relaxed">Our friendly team is here to help.</p>
                  <a href="mailto:support@quickpdf.com" className="text-[#E5322D] font-bold hover:underline text-[15px]">
                    support@quickpdf.com
                  </a>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex items-start gap-5 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mt-1">
                  <MapPin className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-2">Office</h3>
                  <p className="text-[#4A4A55] text-[15px] mb-4 leading-relaxed">Come say hello at our headquarters.</p>
                  <span className="text-[#33333B] font-bold text-[15px]">
                    123 PDF Avenue, Suite 100<br />San Francisco, CA 94107
                  </span>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 flex items-start gap-5 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 shrink-0 bg-green-50 text-green-500 rounded-xl flex items-center justify-center mt-1">
                  <Phone className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#33333B] mb-2">Phone</h3>
                  <p className="text-[#4A4A55] text-[15px] mb-4 leading-relaxed">Mon-Fri from 8am to 5pm.</p>
                  <a href="tel:+15550000000" className="text-[#33333B] font-bold hover:text-[#E5322D] transition-colors text-[15px]">
                    +1 (555) 000-0000
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form (Right Column) */}
            <div className="lg:col-span-3">
              <div className="bg-white p-8 md:p-12 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100">
                <h2 className="text-2xl font-bold text-[#33333B] mb-8">Send us a message</h2>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="block text-[14px] font-bold text-[#33333B]">First name</label>
                      <input type="text" id="firstName" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#33333B] font-medium placeholder-gray-400 focus:outline-none focus:border-[#E5322D] focus:ring-1 focus:ring-[#E5322D] transition-colors" placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lastName" className="block text-[14px] font-bold text-[#33333B]">Last name</label>
                      <input type="text" id="lastName" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#33333B] font-medium placeholder-gray-400 focus:outline-none focus:border-[#E5322D] focus:ring-1 focus:ring-[#E5322D] transition-colors" placeholder="Doe" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-[14px] font-bold text-[#33333B]">Email address</label>
                    <input type="email" id="email" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#33333B] font-medium placeholder-gray-400 focus:outline-none focus:border-[#E5322D] focus:ring-1 focus:ring-[#E5322D] transition-colors" placeholder="john@company.com" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="subject" className="block text-[14px] font-bold text-[#33333B]">Subject</label>
                    <input type="text" id="subject" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#33333B] font-medium placeholder-gray-400 focus:outline-none focus:border-[#E5322D] focus:ring-1 focus:ring-[#E5322D] transition-colors" placeholder="How can we help?" />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="block text-[14px] font-bold text-[#33333B]">Message</label>
                    <textarea id="message" rows={5} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#33333B] font-medium placeholder-gray-400 focus:outline-none focus:border-[#E5322D] focus:ring-1 focus:ring-[#E5322D] transition-colors resize-none" placeholder="Tell us more about your inquiry..."></textarea>
                  </div>

                  <Button type="button" className="w-full h-14 mt-2 rounded-xl bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold text-[15px] transition-transform active:scale-95 flex items-center justify-center gap-2">
                    Send Message
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
