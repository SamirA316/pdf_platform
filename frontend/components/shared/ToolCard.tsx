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
    <Link 
      href={href} 
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-2xl"
    >
      <Card className="h-full flex flex-col bg-white transition-all duration-300 border border-gray-200 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-red-500/30 relative overflow-hidden rounded-2xl cursor-pointer">
        <CardHeader className="p-6 pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${bgColor} ${color} transition-transform duration-300 group-hover:scale-110 group-hover:shadow-sm`}>
              <Icon className="w-7 h-7" strokeWidth={2} />
            </div>
            {badge && (
              <span className="bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>
          <CardTitle className="text-[1.15rem] font-bold tracking-tight text-[#33333B] group-hover:text-red-500 transition-colors">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0 flex-1">
          <CardDescription className="text-[#646470] text-[14px] leading-[1.6] line-clamp-3">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
