"use client";

import AboutPage from "@/components/ABOUT/AboutPage";
import Data from "@/data/Alumni.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicAlumni } from "@/lib/public-content";

export default function Alumni() {
  const { data: alumniResponse } = useGetPublicContentQuery("alumni");
  const alumni = chooseLiveItems(alumniResponse, Data, toPublicAlumni);

  return <AboutPage Data={alumni} />;
}
