"use client";

import JobPipelineHeader from "@/components/JobPipeline/JobPipelineHeader";
import JobPipelineCard from "@/components/JobPipeline/JobPipelineCard";
import Info from "@/data/job-pipeline/Info.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { toPublicDeveloperProfile } from "@/lib/public-content";

export default function JobPipeline() {
  const { data: profilesResponse, isError } = useGetPublicContentQuery("profiles");
  const databaseProfiles = Array.isArray(profilesResponse?.data)
    ? profilesResponse.data.map(toPublicDeveloperProfile)
    : [];
  const profiles = isError ? Info : databaseProfiles;

  return (
    <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
      <JobPipelineHeader />
      <section className="mx-auto grid w-full max-w-[100rem] grid-cols-1 gap-6 px-8 py-2 lg:grid-cols-2 lg:gap-10">
        {profiles.map((profile) => (
          <JobPipelineCard key={profile.id || profile.email} data={profile} />
        ))}
      </section>
    </div>
  );
}



