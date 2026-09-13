import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface ToolCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color?: string; // e.g., 'text-red-500', 'text-blue-500'
  bgColor?: string; // e.g., 'bg-red-50', 'bg-blue-50'
  badge?: string; // 'New!'
}

export function ToolCard({ title, description, icon: Icon, href, color = "text-red-500", bgColor = "bg-red-50", badge }: ToolCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full bg-white transition-all duration-200 border-gray-200 shadow-sm hover:shadow-md relative overflow-hidden rounded-2xl">
        <CardHeader className="pb-3 pt-6 px-6">
          <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${bgColor} ${color}`}>
              <Icon className="w-8 h-8" strokeWidth={1.5} />
            </div>
            {badge && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-gray-900 group-hover:text-red-600 transition-colors">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <CardDescription className="text-gray-500 text-sm leading-relaxed line-clamp-3">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
