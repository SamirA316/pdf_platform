import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import blogData from "@/data/blog.json";

const { featuredPost, blogPosts } = blogData;

export default function BlogPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-hidden relative">
        {/* Decorative Background blob matching homepage */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-[#FFF0F0] to-transparent -z-10 opacity-60 pointer-events-none" />
        
        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto text-center md:text-left">
          <h1 className="text-4xl md:text-[52px] font-bold tracking-tight text-[#33333B] mb-6 leading-tight">
            The QuickPDF Blog
          </h1>
          <p className="text-lg md:text-xl text-[#4A4A55] max-w-2xl font-medium leading-relaxed">
            Discover product updates, helpful guides, engineering deep-dives, and best practices for managing your digital documents.
          </p>
        </section>

        {/* Featured Post */}
        <section className="px-4 sm:px-6 lg:px-8 mb-16 max-w-[1200px] mx-auto">
          <Link href={`/blog/${featuredPost.slug}`} className="group block">
            <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden flex flex-col md:flex-row transition-transform duration-300 hover:-translate-y-1">
              <div className="md:w-1/2 h-64 md:h-auto bg-slate-100 relative overflow-hidden flex items-center justify-center p-12">
                {/* Placeholder Illustration */}
                <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col p-6 group-hover:scale-105 transition-transform duration-500">
                  <div className="h-4 w-1/3 bg-gray-200 rounded mb-8" />
                  <div className="h-4 w-full bg-red-100 rounded mb-4" />
                  <div className="h-4 w-5/6 bg-red-100 rounded mb-4" />
                  <div className="h-4 w-4/6 bg-red-100 rounded" />
                </div>
              </div>
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full bg-red-50 text-[#E5322D] text-xs font-bold uppercase tracking-wider">{featuredPost.category}</span>
                  <span className="text-gray-400 text-sm font-medium">{featuredPost.date}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-[#33333B] mb-4 group-hover:text-[#E5322D] transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-[#4A4A55] text-lg leading-relaxed mb-6">
                  {featuredPost.excerpt}
                </p>
                <span className="inline-flex items-center text-[#E5322D] font-bold group-hover:underline">
                  Read article <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </Link>
        </section>

        {/* Blog Grid */}
        <section className="px-4 sm:px-6 lg:px-8 mb-24 max-w-[1200px] mx-auto">
          <h3 className="text-2xl font-bold text-[#33333B] mb-8">Latest Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, i) => (
              <Link href={`/blog/${post.slug}`} key={i} className="group flex flex-col">
                <div className="bg-white rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 p-8 flex-1 flex flex-col hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${post.color}`}>
                      {post.category}
                    </span>
                    <span className="text-gray-400 text-sm font-medium">{post.date}</span>
                  </div>
                  <h4 className="text-xl font-bold text-[#33333B] mb-3 group-hover:text-[#E5322D] transition-colors leading-snug">
                    {post.title}
                  </h4>
                  <p className="text-[#4A4A55] text-[15px] leading-relaxed mb-6 flex-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-gray-400 text-sm font-medium">{post.readTime}</span>
                    <span className="text-[#E5322D] font-bold group-hover:underline text-[15px] flex items-center">
                      Read <ArrowRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
