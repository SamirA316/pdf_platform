import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ToolCard } from "@/components/shared/ToolCard";
import { getToolsByCategory } from "@/config/tools";
import { Sparkles } from "lucide-react";

export default function AIToolsPage() {
  const tools = getToolsByCategory("ai");

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 bg-secondary/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-6 text-primary shadow-sm border border-primary/20">
              <Sparkles className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              Work smarter with AI
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Unlock advanced document understanding. Summarize, extract, and chat with your files effortlessly.
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
                color={tool.color}
                bgColor={tool.bgColor}
                badge={tool.badge}
              />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
