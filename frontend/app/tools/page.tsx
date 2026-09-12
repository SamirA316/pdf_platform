import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ToolCard } from "@/components/shared/ToolCard";
import { getToolsByCategory } from "@/config/tools";
import { FileText } from "lucide-react";

export default function PDFToolsPage() {
  const tools = getToolsByCategory("pdf");

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 bg-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-6 text-primary">
              <FileText className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              All PDF Tools
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to compress, convert, merge, and edit your PDF files.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tools.map((tool) => (
              <ToolCard
                key={tool.slug}
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                href={`/tools/${tool.slug}`}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
