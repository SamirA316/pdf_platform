import React from "react";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "w-9 h-9" }: LogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        <linearGradient id="qRing" x1="15" y1="15" x2="70" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF512F"/>
          <stop offset="100%" stopColor="#DD2476"/>
        </linearGradient>
        <linearGradient id="qDoc" x1="56" y1="56" x2="84" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#DD2476"/>
          <stop offset="100%" stopColor="#8B0000"/>
        </linearGradient>
        <filter id="softShadow" x="-10" y="-10" width="120" height="120" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.15"/>
        </filter>
      </defs>

      {/* Outer ring of the Q */}
      <circle cx="42" cy="42" r="26" stroke="url(#qRing)" strokeWidth="14" filter="url(#softShadow)"/>
      
      {/* The tail of the Q as a document shape */}
      <path d="M56 62 A 6 6 0 0 1 62 56 H 72 L 84 68 V 84 A 6 6 0 0 1 78 90 H 62 A 6 6 0 0 1 56 84 Z" fill="url(#qDoc)" filter="url(#softShadow)"/>
      
      {/* The folded corner of the document */}
      <path d="M72 56 V 68 H 84 Z" fill="#FF9A9A" opacity="0.95"/>
      
      {/* Tiny document lines */}
      <rect x="62" y="74" width="14" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.9"/>
      <rect x="62" y="80" width="8" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.9"/>
    </svg>
  );
}
