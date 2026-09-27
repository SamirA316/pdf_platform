import { getToolBySlug } from "@/config/tools";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ToolWorkspace } from "@/components/shared/ToolWorkspace";

interface PageProps {
  params: Promise<{ toolSlug: string }>;
}

export default async function ToolPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tool = getToolBySlug(resolvedParams.toolSlug);

  if (!tool) {
    notFound();
  }

  const isWideWorkspace = resolvedParams.toolSlug === "organize-pdf";
  const isComingSoon = tool.status === "COMING_SOON";

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F5]">
      <Navbar />
      
      <main className="flex-1 pt-16 pb-24">
        <div className={`${isWideWorkspace ? "max-w-7xl" : "max-w-4xl"} mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10`}>
           
           <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight text-[#33333B] mb-4">
             {tool.title}
           </h1>
           
           <p className="text-lg md:text-xl text-[#4A4A55] max-w-2xl mx-auto font-medium leading-relaxed mb-8">
             {tool.description}
           </p>

           <div className="mt-8">
             {isComingSoon ? (
               <div className="bg-white rounded-3xl p-10 max-w-lg mx-auto shadow-sm border border-neutral-200 text-center">
                 <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">
                   ⏳
                 </div>
                 <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 mb-3">
                   Coming Soon
                 </span>
                 <h2 className="text-2xl font-bold text-[#33333B] mb-2">In Active Development</h2>
                 <p className="text-[#4A4A55] text-sm leading-relaxed mb-6">
                   For our initial rock-solid public release, we are prioritizing our 12 Core PDF Tools. This feature is scheduled for the upcoming phase!
                 </p>
                 <Link
                   href="/#tools"
                   className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#E5322D] text-white font-semibold text-sm hover:bg-[#CC2B26] transition-colors shadow-sm"
                 >
                   Explore 12 Live PDF Tools
                 </Link>
               </div>
             ) : (
               <ToolWorkspace 
                 slug={tool.slug}
                 accept={tool.accept} 
                 maxSizeMB={tool.maxSizeMB} 
                 actionType={tool.actionType}
                 allowMultiple={tool.allowMultiple}
                 title={tool.title}
               />
             )}
           </div>
        </div>

        {/* Informational Section */}
        {!isComingSoon && (
          <div className="max-w-3xl mx-auto mt-32 px-4 text-center">
            <h2 className="text-2xl font-bold mb-4 text-[#33333B]">How to use {tool.title}</h2>
            <div className="w-12 h-1 bg-[#E5322D] mx-auto rounded-full mb-6" />
            <p className="text-[#4A4A55] text-lg leading-relaxed">
              Drag and drop your <span className="font-bold text-[#33333B]">{tool.accept.replace(/\./g, '').split(',').join(' or ').toUpperCase()}</span> file into the box above. Our secure system will automatically apply the operation while preserving your privacy. Once the processing is done, you can download the result immediately.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
