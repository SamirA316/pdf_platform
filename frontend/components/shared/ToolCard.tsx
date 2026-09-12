import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, LucideIcon } from "lucide-react";
import Link from "next/link";

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  accent?: boolean;
}

export function ToolCard({ title, description, icon: Icon, href, accent = false }: ToolCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className={`h-full transition-all duration-200 border-border shadow-sm hover:shadow-md hover:border-primary/50 relative overflow-hidden ${accent ? 'bg-accent/30' : 'bg-card'}`}>
        {accent && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
        )}
        <CardHeader className="pb-3">
          <div className={`mb-3 inline-flex p-3 rounded-xl ${accent ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'}`}>
            <Icon className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-muted-foreground mb-4 line-clamp-2">
            {description}
          </CardDescription>
          <div className="flex items-center text-sm font-medium text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
            Try this tool <ArrowRight className="ml-1 w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
