"use client";

import { Skeleton } from "@/components/ui/skeleton";
import AboutPage from "@/components/ABOUT/AboutPage";
import Data from "@/data/Alumni.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicAlumni } from "@/lib/public-content";

export default function Alumni() {
  const { data: alumniResponse, isLoading, isError } = useGetPublicContentQuery("alumni");
  const alumni = chooseLiveItems(alumniResponse, Data, toPublicAlumni, isLoading, isError);

  if (alumni === null) {
    return (
      <main className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-3 xl:gap-10 padding py-16 bg-responsibility">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="group bg-white flex flex-col items-center justify-between gap-8 px-3 pt-3 pb-7">
            <Skeleton className="h-[20rem] w-full" />
            <section className="flex flex-col items-center text-center justify-center gap-2 w-full">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3 mt-1" />
            </section>
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
        ))}
      </main>
    );
  }

  return <AboutPage Data={alumni} />;
}
