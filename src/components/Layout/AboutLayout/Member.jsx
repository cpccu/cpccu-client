"use client";
// import committee from "@/data/Committee.json";
// import alumni from "@/data/Alumni.json";
import { Skeleton } from "@/components/ui/skeleton";
import AboutPage from "@/components/ABOUT/AboutPage";
import { useFetchMembersQuery } from "@/features/members/memberApi";

export default function Member() {
  const { data: response, isLoading, isError } = useFetchMembersQuery();
  const users = response?.data || [];

  if (isLoading) {
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
  if (isError) {
    return <div>Error loading members.</div>;
  }
  const roleOrder = {
    committee: 0,
    admin: 1,
    moderator: 2,
    mentor: 3,
    member: 4,
    alumni: 5,
  };

  const Data = users
    .filter((user) => user?.isValid !== false)
    .map((user) => ({
      ...user,
      displayPosition: "member",
    }))
    .sort((a, b) => {
      const roleA = a?.roles?.role || "member";
      const roleB = b?.roles?.role || "member";
      const orderA = roleOrder[roleA] ?? 99;
      const orderB = roleOrder[roleB] ?? 99;

      if (orderA !== orderB) return orderA - orderB;
      return (a?.fullName || "").localeCompare(b?.fullName || "");
    });

  return <AboutPage Data={Data} />;
}
