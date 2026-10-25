"use client";
import { Skeleton } from "@/components/ui/skeleton";
import AboutPage from "@/components/ABOUT/AboutPage";
import PreviousCommittee from "@/components/ABOUT/PreviousCommittee";
import CommitteeData from "@/data/Committee.json";
import PreviousCommitteeData from "@/data/PreviousCommittee.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { useGetCertificateSignatoriesQuery } from "@/features/certificate/certificateApi";
import { groupCommitteeMembers } from "@/lib/committee";

export default function Committee() {
  const { data: response, isLoading } = useGetPublicContentQuery("committees");
  // The committee list is the server's registry (six serials, chronological).
  // The signatories endpoint serves that list, so the client never repeats it.
  const { data: signatoriesResponse, isLoading: signatoriesLoading } = useGetCertificateSignatoriesQuery();

  // The skeleton covers both requests: rendering the JSON fallback for a frame
  // and then swapping it for the API data is a visible flash.
  if (isLoading || signatoriesLoading) {
    return (
      <>
        <section>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 padding py-8 text-center">Current Committee</h2>
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
        </section>
        <section className="padding py-16">
          <Skeleton className="h-10 w-64 mx-auto mb-10" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-3 xl:gap-10">
            {Array.from({ length: 4 }).map((_, i) => (
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
          </div>
        </section>
      </>
    );
  }

  const liveItems = response?.data || [];
  const canonicalCommittees = signatoriesResponse?.data?.committees || [];

  // The API path is primary; the bundled JSON is the fallback for when the
  // committee list or the members cannot be loaded.
  const useFallback = canonicalCommittees.length === 0 || liveItems.length === 0;

  const { groups, currentKey } = useFallback
    ? { groups: [], currentKey: null }
    : groupCommitteeMembers(liveItems, canonicalCommittees);

  const currentGroup = groups.find((group) => group.key === currentKey);
  const previousGroups = groups.filter((group) => group.key !== currentKey);

  const committee = useFallback ? CommitteeData || [] : currentGroup?.members || [];
  const previousCommittees = useFallback
    ? PreviousCommitteeData
    : previousGroups.map((group) => ({
        year: group.label,
        startYear: group.startYear,
        members: group.members,
      }));

  return (
    <>
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 padding py-8 text-center">Current Committee</h2>
        {!useFallback && currentGroup?.label && (
          <p className="text-center text-muted-foreground -mt-4 pb-2">{currentGroup.label}</p>
        )}
        {committee.length > 0 ? (
          <AboutPage Data={committee} />
        ) : (
          <p className="padding py-16 bg-responsibility text-center text-muted-foreground">
            No committee members have been listed for this committee yet.
          </p>
        )}
      </section>
      <PreviousCommittee data={previousCommittees} />
    </>
  );
}
