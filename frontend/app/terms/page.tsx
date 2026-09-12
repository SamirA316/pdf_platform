import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 bg-background py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-6">
            Terms of Service
          </h1>
          <p className="text-lg text-muted-foreground mb-12">
            This page is currently under construction. Please check back later.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
