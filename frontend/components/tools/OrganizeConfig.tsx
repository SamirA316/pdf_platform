"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid } from "lucide-react";

interface OrganizeConfigProps {
  files: File[];
  onProcess: (config?: Record<string, unknown>) => void;
}

export function OrganizeConfig({ files, onProcess }: OrganizeConfigProps) {
  const [pageOrder, setPageOrder] = useState("1, 2, 3");

  const handleSubmit = () => {
    // Parse the input string into a JSON array string as expected by backend
    try {
      const orderArray = pageOrder.split(',').map(num => parseInt(num.trim(), 10)).filter(num => !isNaN(num));
      onProcess({ pageOrder: JSON.stringify(orderArray) });
    } catch (err) {
      alert("Invalid page order format. Please use comma separated numbers like: 1, 2, 3");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-3xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-orange-100 rounded-full mb-4 text-orange-600">
          <LayoutGrid className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Organize PDF Pages</h3>
        <p className="text-muted-foreground mt-2">
          File: <span className="font-medium text-foreground">{files[0]?.name}</span>
        </p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-foreground mb-2">Page Order (Comma separated)</label>
        <input
          type="text"
          value={pageOrder}
          onChange={(e) => setPageOrder(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="e.g. 3, 1, 2"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Enter the new order of pages using their original 1-indexed page numbers.
        </p>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleSubmit} 
          className="w-full h-10 rounded-lg font-bold shadow-sm"
          disabled={!pageOrder}
        >
          Organize Pages
        </Button>
      </div>
    </div>
  );
}
