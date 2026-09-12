import { getToolBySlug } from "@/config/tools";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ToolWorkspace } from "@/components/shared/ToolWorkspace";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ toolSlug: string }>;
}

export default async function ToolPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tool = getToolBySlug(resolvedParams.toolSlug);

  if (!tool) {
    notFound();
  }

  const categoryName = tool.category === "pdf" ? "PDF Tools" : tool.category === "image" ? "Image Tools" : "AI Tools";
  const categoryLink = tool.category === "pdf" ? "/tools" : tool.category === "image" ? "/image-tools" : "/ai-tools";
  const Icon = tool.icon;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Breadcrumbs */}
          <nav className="flex items-center text-sm text-muted-foreground mb-8">
            <Link href="/" className="hover:text-primary transition-colors flex items-center">
              <Home className="w-4 h-4 mr-1" /> Home
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <Link href={categoryLink} className="hover:text-primary transition-colors">
              {categoryName}
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-foreground font-medium">{tool.title}</span>
          </nav>

          {/* Tool Header */}
          <div className="text-center mb-12">
            <div className="inline-flex p-4 rounded-2xl bg-primary/10 text-primary mb-6">
              <Icon className="w-10 h-10" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
              {tool.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {tool.description}
            </p>
          </div>

          {/* Interactive Workspace */}
          <ToolWorkspace 
            accept={tool.accept} 
            maxSizeMB={tool.maxSizeMB} 
            actionType={tool.actionType}
            allowMultiple={tool.allowMultiple}
            title={tool.title}
          />
          
          {/* SEO Content / Details */}
          <div className="max-w-3xl mx-auto mt-24 text-center">
            <h2 className="text-2xl font-bold mb-4">How to use {tool.title}?</h2>
            <p className="text-muted-foreground mb-8">
              Just drag and drop your {tool.accept.replace(/\./g, '').split(',').join(' or ')} file into the box above. Our secure system will automatically apply the {tool.title} operation while preserving your privacy. Once the processing is done, you can download the result immediately.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
