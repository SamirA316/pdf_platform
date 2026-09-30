import { getToolBySlug } from "@/config/tools";
import { notFound } from "next/navigation";
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

  const isEditTool = resolvedParams.toolSlug === "edit-pdf";
  const isWideWorkspace = resolvedParams.toolSlug === "edit-pdf" || resolvedParams.toolSlug === "sign-pdf" || resolvedParams.toolSlug === "organize-pdf";

  return (
    <div className={`flex flex-col ${isEditTool ? "h-screen overflow-hidden" : "min-h-screen"} bg-[#F3F4F5]`}>
      <Navbar />
      
      <main className={`flex-1 ${isEditTool ? "p-1 sm:p-2 overflow-hidden flex flex-col" : "pt-12 pb-24"}`}>
        <div className={`${isEditTool ? "w-full max-w-full" : isWideWorkspace ? "max-w-[1560px] mx-auto text-center" : "max-w-4xl mx-auto text-center"} w-full px-1 sm:px-2 md:px-4 relative z-10 ${isEditTool ? "flex-1 flex flex-col min-h-0" : ""}`}>
           
           {!isEditTool && (
             <>
               <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight text-[#33333B] mb-4">
                 {tool.title}
               </h1>
               
               <p className="text-lg md:text-xl text-[#4A4A55] max-w-2xl mx-auto font-medium leading-relaxed mb-8">
                 {tool.description}
               </p>
             </>
           )}

           <div className={isEditTool ? "flex-1 flex flex-col min-h-0 mt-0" : "mt-8"}>
             <ToolWorkspace 
               slug={tool.slug}
               accept={tool.accept} 
               maxSizeMB={tool.maxSizeMB} 
               actionType={tool.actionType}
               allowMultiple={tool.allowMultiple}
               title={tool.title}
             />
           </div>
        </div>

        {/* Informational Section */}
        {!isEditTool && (
          <div className="max-w-3xl mx-auto mt-32 px-4 text-center">
            <h2 className="text-2xl font-bold mb-4 text-[#33333B]">How to use {tool.title}</h2>
            <div className="w-12 h-1 bg-[#E5322D] mx-auto rounded-full mb-6" />
            <p className="text-[#4A4A55] text-lg leading-relaxed">
              Drag and drop your <span className="font-bold text-[#33333B]">{tool.accept.replace(/\./g, '').split(',').join(' or ').toUpperCase()}</span> file into the box above. Our secure system will automatically apply the operation while preserving your privacy. Once the processing is done, you can download the result immediately.
            </p>
          </div>
        )}
      </main>

      {!isEditTool && <Footer />}
    </div>
  );
}
