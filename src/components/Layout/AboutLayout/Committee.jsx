"use client";
import { Skeleton } from "@/components/ui/skeleton";
import AboutPage from "@/components/ABOUT/AboutPage";
import PreviousCommittee from "@/components/ABOUT/PreviousCommittee";
import CommitteeData from "@/data/Committee.json";
import PreviousCommitteeData from "@/data/PreviousCommittee.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";

export default function Committee() {
  const { data: response, isLoading, isError } = useGetPublicContentQuery("committees");

  if (isLoading) {
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
  const runningCommittee = liveItems
    .filter((item) => item.group === "running")
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((item) => ({
      ...item,
      img: item.img || item.avatar,
      name: item.name || item.fullName,
    }));
  const previousCommitteeGroups = Object.values(
    liveItems
      .filter((item) => item.group === "previous")
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .reduce((groups, item) => {
        const year = item.term || "Previous Committee";
        groups[year] ||= { year, members: [] };
        groups[year].members.push({
          ...item,
          _id: item._id || item.id,
          fullName: item.fullName || item.name,
          avatar: item.avatar || item.img,
        });
        return groups;
      }, {})
  );
  const committee = runningCommittee.length ? runningCommittee : CommitteeData || [];
  const previousCommittees = previousCommitteeGroups.length ? previousCommitteeGroups : PreviousCommitteeData;

  return (
    <>
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 padding py-8 text-center">Current Committee</h2>
        <AboutPage Data={committee} />
      </section>
      <PreviousCommittee data={previousCommittees} />
    </>
  );
}
