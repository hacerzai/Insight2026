"use client";

import { useEffect } from "react";

const sources = [
  "/tinybot.js",
];

export default function ScriptLoader() {
  useEffect(() => {
    let cancelled = false;
    const loadInOrder = async () => {
      for (const src of sources) {
        if (cancelled || document.querySelector(`script[src="${src}"]`)) continue;
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = src;
          script.async = false;
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.body.appendChild(script);
        });
      }
    };
    loadInOrder();
    return () => { cancelled = true; };
  }, []);
  return null;
}
