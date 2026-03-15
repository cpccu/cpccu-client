"use client";

import { useState } from "react";
import GalleryScroll from "@/Context/GalleryScroll/GalleryScroll";

export default function GalleryScrollProvider({ children }) {
  const [scrollTarget, setScrollTarget] = useState(null);

  return (
    <GalleryScroll.Provider value={{ scrollTarget, setScrollTarget }}>
      {children}
    </GalleryScroll.Provider>
  );
}
