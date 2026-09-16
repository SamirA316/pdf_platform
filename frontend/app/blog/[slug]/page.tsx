import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, Share2, Link2, Mail } from "lucide-react";
import { use } from "react";
import blogData from "@/data/blog.json";
import { notFound } from "next/navigation";

const { featuredPost, blogPosts } = blogData;

function getPostBySlug(slug: string) {
  if (slug === featuredPost.slug) return featuredPost;
  return blogPosts.find(post => post.slug === slug);
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  // In Next.js 15+, route params are async and should be awaited
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-hidden relative pb-24">
        {/* Decorative Background blob */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-gray-50 to-transparent -z-10 pointer-events-none" />

        <article className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          {/* Back button */}
          <Link href="/blog" className="inline-flex items-center text-[#4A4A55] hover:text-[#E5322D] font-semibold text-sm mb-10 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <span className="px-3 py-1 rounded-full bg-red-50 text-[#E5322D] text-xs font-bold uppercase tracking-wider">
                {post.category}
              </span>
              <div className="flex items-center text-gray-500 text-sm font-medium gap-4">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {post.date}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {post.readTime}</span>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[52px] font-bold tracking-tight text-[#33333B] mb-8 leading-[1.1]">
              {post.title}
            </h1>

            <div className="flex items-center justify-between border-y border-gray-100 py-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-lg">
                  {post.author.avatar}
                </div>
                <div>
                  <div className="font-bold text-[#33333B]">{post.author.name}</div>
                  <div className="text-sm text-gray-500 font-medium">{post.author.role}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 mr-2 hidden sm:block">Share:</span>
                <button className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 text-[#4A4A55] flex items-center justify-center transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 text-[#4A4A55] flex items-center justify-center transition-colors">
                  <Link2 className="w-4 h-4" />
                </button>
                <button className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 text-[#4A4A55] flex items-center justify-center transition-colors">
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Featured Image Placeholder */}
          <div className="w-full aspect-[21/9] bg-slate-100 rounded-3xl mb-12 flex items-center justify-center overflow-hidden border border-gray-200">
             <div className="w-full h-full bg-gradient-to-tr from-gray-200 to-gray-50 flex items-center justify-center">
               <div className="w-32 h-32 bg-white rounded-3xl shadow-sm rotate-12 flex flex-col p-4 opacity-50">
                  <div className="w-full h-3 bg-red-100 rounded mb-2" />
                  <div className="w-3/4 h-3 bg-red-100 rounded mb-2" />
                  <div className="w-5/6 h-3 bg-red-100 rounded" />
               </div>
             </div>
          </div>

          {/* Article Content */}
          <div 
            className="prose prose-lg max-w-none text-[#4A4A55] prose-headings:text-[#33333B] prose-headings:font-bold prose-a:text-[#E5322D] prose-strong:text-[#33333B] prose-blockquote:border-l-[#E5322D] prose-blockquote:bg-gray-50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-[#33333B] prose-blockquote:font-medium prose-li:marker:text-gray-400"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          
          <hr className="my-12 border-gray-100" />
          
          {/* Footer CTA */}
          <div className="bg-[#FAFAFA] rounded-3xl p-8 md:p-10 text-center border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <h3 className="text-2xl font-bold text-[#33333B] mb-4">Want to read more?</h3>
            <p className="text-[#4A4A55] mb-8 font-medium">Subscribe to our newsletter to get the latest product updates and guides delivered straight to your inbox.</p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input type="email" placeholder="Enter your email" className="flex-1 rounded-full border border-gray-200 px-6 py-3 focus:outline-none focus:ring-2 focus:ring-[#E5322D]/20 focus:border-[#E5322D]" />
              <button className="bg-[#E5322D] hover:bg-[#CC2A26] text-white font-bold px-8 py-3 rounded-full transition-colors">
                Subscribe
              </button>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
