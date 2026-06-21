"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, AlertTriangle, Users } from "lucide-react";
import JobPipelineHeader from "@/components/JobPipeline/JobPipelineHeader";
import JobPipelineCard from "@/components/JobPipeline/JobPipelineCard";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { toPublicDeveloperProfile } from "@/lib/public-content";

export default function JobPipeline() {
  const { data: profilesResponse, isLoading, isError } = useGetPublicContentQuery("profiles");

  if (isLoading) {
    return (
      <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
        <JobPipelineHeader />
        <section className="mx-auto grid w-full max-w-[100rem] grid-cols-1 gap-6 px-8 py-2 lg:grid-cols-2 lg:gap-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex gap-4">
                <Skeleton className="w-24 h-24 rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex gap-2 mt-1">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-16 rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
        <JobPipelineHeader />
        <section className="mx-auto flex w-full max-w-[100rem] flex-col items-center justify-center gap-6 px-8 py-24">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Unable to Load Developer Profiles</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              We couldn't retrieve the job pipeline profiles. Please try again later.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const profiles = Array.isArray(profilesResponse?.data)
    ? profilesResponse.data.map(toPublicDeveloperProfile)
    : [];

  if (profiles.length === 0) {
    return (
      <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
        <JobPipelineHeader />
        <section className="mx-auto flex w-full max-w-[100rem] flex-col items-center justify-center gap-6 px-8 py-24">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-blue-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">No Approved Developer Profiles Yet</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Developer profiles will appear here once approved by the admin team. Check back soon!
            </p>
          </div>
        </section>
      </div>
    );
  }

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
