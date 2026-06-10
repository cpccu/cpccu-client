"use client";

import JobPipelineHeader from "@/components/JobPipeline/JobPipelineHeader";
import JobPipelineHeroSection from "@/components/JobPipeline/JobPipelineHeroSection";
import JobPipelineCard from "@/components/JobPipeline/JobPipelineCard";
import Info from "@/data/job-pipeline/Info.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicDeveloperProfile } from "@/lib/public-content";

export default function JobPipeline() {
  const { data: profilesResponse } = useGetPublicContentQuery("profiles");
  const profiles = chooseLiveItems(profilesResponse, Info, toPublicDeveloperProfile);

  return (
    <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
      <JobPipelineHeader />
      <JobPipelineHeroSection />
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:px-8">
        {profiles.map((profile) => (
          <JobPipelineCard key={profile.id || profile.email} data={profile} />
        ))}
      </section>
    </div>
  );
}




