import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { UploadDropzone } from "@/components/shared/UploadDropzone";
import { ToolCard } from "@/components/shared/ToolCard";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  FileText, Image as ImageIcon, Wand2, Scissors, 
  Combine, ArrowRightLeft, Shrink, Type, Sparkles,
  ShieldCheck, Zap, Trash2, UserX, CheckCircle2, Search
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 max-w-4xl mx-auto">
            Everything you need to work with PDFs and images.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Compress, convert, merge, resize, edit and transform your files in seconds — fast, simple and secure.
          </p>
          
          <UploadDropzone />
          
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="#tools">
              <Button variant="outline" size="lg" className="rounded-full px-8 font-medium border-border">
                Explore Tools
              </Button>
            </Link>
          </div>
        </section>

        {/* TRUST / VALUE STRIP */}
        <section className="py-12 border-y border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="flex flex-col items-center justify-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-primary" strokeWidth={1.5} />
                <span className="font-medium text-foreground">Secure processing</span>
              </div>
              <div className="flex flex-col items-center justify-center space-y-2">
                <Zap className="w-8 h-8 text-primary" strokeWidth={1.5} />
                <span className="font-medium text-foreground">Lightning fast</span>
              </div>
              <div className="flex flex-col items-center justify-center space-y-2">
                <Trash2 className="w-8 h-8 text-primary" strokeWidth={1.5} />
                <span className="font-medium text-foreground">Auto-deleted files</span>
              </div>
              <div className="flex flex-col items-center justify-center space-y-2">
                <UserX className="w-8 h-8 text-primary" strokeWidth={1.5} />
                <span className="font-medium text-foreground">No registration</span>
              </div>
            </div>
          </div>
        </section>

        {/* POPULAR TOOLS */}
        <section id="tools" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Popular Tools</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Our most frequently used utilities by students and professionals.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ToolCard 
              title="Compress PDF" 
              description="Reduce file size while optimizing for maximal PDF quality."
              icon={Shrink}
              href="/tools/compress-pdf"
            />
            <ToolCard 
              title="Merge PDF" 
              description="Combine multiple PDFs into one unified document."
              icon={Combine}
              href="/tools/merge-pdf"
            />
            <ToolCard 
              title="PDF to Word" 
              description="Easily convert your PDF files into easy to edit DOC and DOCX."
              icon={ArrowRightLeft}
              href="/tools/pdf-to-word"
            />
            <ToolCard 
              title="Passport Photo" 
              description="Create a standard size passport photo and print sheet instantly."
              icon={ImageIcon}
              href="/tools/passport-photo"
              accent
            />
          </div>
        </section>

        {/* PDF TOOLS SECTION */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-secondary/20 rounded-3xl mb-12">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Powerful PDF tools, made simple.</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ToolCard title="Split PDF" description="Separate one page or a whole set for easy conversion into independent PDF files." icon={Scissors} href="/tools/split-pdf" />
            <ToolCard title="PDF to JPG" description="Convert each PDF page into a JPG or extract all images contained in a PDF." icon={ImageIcon} href="/tools/pdf-to-jpg" />
            <ToolCard title="JPG to PDF" description="Adjust orientation and margins." icon={FileText} href="/tools/jpg-to-pdf" />
            <ToolCard title="PDF Editor" description="Add text, images, shapes or freehand annotations to a PDF document." icon={Type} href="/tools/edit-pdf" />
          </div>
        </section>

        {/* AI TOOLS SECTION */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 -z-10" />
          <div className="max-w-7xl mx-auto text-center mb-16">
            <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-6 text-primary">
              <Sparkles className="w-5 h-5 mr-2" />
              <span className="font-semibold text-sm pr-2">Premium Features</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground mb-6">Work smarter with AI.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Unlock advanced document understanding. Summarize, extract, and chat with your files.
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link href="/tools/ai-summary" className="bg-card border border-border p-8 rounded-2xl shadow-sm text-center hover:border-primary/50 hover:shadow-md transition-all group block">
              <Search className="w-10 h-10 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              <h3 className="text-xl font-semibold mb-2 text-foreground">AI Summary</h3>
              <p className="text-muted-foreground text-sm">Instantly summarize 100-page reports into bullet points.</p>
            </Link>
            <Link href="/tools/chat-pdf" className="bg-card border border-border p-8 rounded-2xl shadow-sm text-center relative overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group block">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
              <Wand2 className="w-10 h-10 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              <h3 className="text-xl font-semibold mb-2 text-foreground">Chat with PDF</h3>
              <p className="text-muted-foreground text-sm">Ask questions and get answers directly from your document.</p>
            </Link>
            <Link href="/tools/extract-data" className="bg-card border border-border p-8 rounded-2xl shadow-sm text-center hover:border-primary/50 hover:shadow-md transition-all group block">
              <FileText className="w-10 h-10 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              <h3 className="text-xl font-semibold mb-2 text-foreground">Extract Data</h3>
              <p className="text-muted-foreground text-sm">Pull structured data like tables and names automatically.</p>
            </Link>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-16">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-border -z-10 -translate-y-1/2" />
            <div className="flex flex-col items-center bg-background">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-6 shadow-md z-10">1</div>
              <h3 className="text-xl font-semibold mb-2">Upload your file</h3>
              <p className="text-muted-foreground text-sm">Drag and drop or select your document safely.</p>
            </div>
            <div className="flex flex-col items-center bg-background">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-6 shadow-md z-10">2</div>
              <h3 className="text-xl font-semibold mb-2">Choose a tool</h3>
              <p className="text-muted-foreground text-sm">Select the exact operation you need performed.</p>
            </div>
            <div className="flex flex-col items-center bg-background">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-6 shadow-md z-10">3</div>
              <h3 className="text-xl font-semibold mb-2">Download your result</h3>
              <p className="text-muted-foreground text-sm">Get your processed file in seconds.</p>
            </div>
          </div>
        </section>

        {/* WHY CHOOSE US */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-secondary/50 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-4">Why Choose Us</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Built from the ground up for speed, privacy, and simplicity.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Fast', desc: 'Process everyday files quickly without waiting.' },
                { title: 'Simple', desc: 'No complicated settings or frustrating workflows.' },
                { title: 'Private', desc: 'Files are processed securely and removed automatically.' },
                { title: 'Affordable', desc: 'Generous free usage and affordable Pro plans.' }
              ].map((feature, i) => (
                <div key={i} className="bg-background p-6 rounded-2xl border border-border shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground mb-16">Simple pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
            {/* Free Plan */}
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-6">₹0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-muted-foreground text-sm">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Basic tools</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Limited daily usage</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Standard processing</li>
              </ul>
              <Button variant="outline" className="w-full rounded-full border-border">Get Started</Button>
            </div>
            {/* Pro Plan */}
            <div className="bg-primary/5 border-2 border-primary p-8 rounded-3xl shadow-md flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-full">RECOMMENDED</div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-6">₹199<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-foreground text-sm font-medium">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Higher limits</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Batch processing</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Faster processing</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> No ads</li>
              </ul>
              <Button className="w-full rounded-full">Upgrade to Pro</Button>
            </div>
            {/* AI Pro Plan */}
            <div className="bg-card border border-border p-8 rounded-3xl shadow-sm flex flex-col">
              <h3 className="text-xl font-semibold mb-2">AI Pro</h3>
              <div className="text-4xl font-bold mb-6">₹399<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-muted-foreground text-sm">
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> All Pro features</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> AI PDF features</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> High AI limits</li>
                <li className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> Advanced document tools</li>
              </ul>
              <Button variant="outline" className="w-full rounded-full border-border">Get AI Pro</Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center text-foreground mb-12">Frequently Asked Questions</h2>
          <Accordion className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-left font-medium">Are my files secure?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes, absolutely. All file transfers are secured with advanced encryption. Once processed, your files are automatically and permanently deleted from our servers according to our retention policy to ensure maximum privacy.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-left font-medium">Do I need an account?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                No, you can use our basic tools without creating an account. However, registering for an account unlocks higher usage limits, history, and advanced features.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-left font-medium">Can I use the tools on mobile?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes! Our platform is fully responsive and designed to work seamlessly on mobile devices, tablets, and desktop computers.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-left font-medium">Is the service free?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                We offer a generous free tier that covers most everyday tasks. For high-volume processing, batch operations, or AI tools, we offer affordable Pro plans.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to simplify your files?</h2>
            <p className="text-lg text-primary-foreground/80 mb-10">Upload a file and get started in seconds.</p>
            <Link href="/tools">
              <Button size="lg" variant="secondary" className="rounded-full px-10 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow text-primary">
                Upload File
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
