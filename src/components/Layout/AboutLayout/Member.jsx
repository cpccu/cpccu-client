"use client";
// import committee from "@/data/Committee.json";
// import alumni from "@/data/Alumni.json";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, AlertTriangle, SearchX } from "lucide-react";
import AboutPage from "@/components/ABOUT/AboutPage";
import { useFetchMembersQuery } from "@/features/members/memberApi";

export default function Member() {
  const { data: response, isLoading, isError } = useFetchMembersQuery();

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
    return (
      <main className="flex flex-col items-center justify-center gap-6 padding py-24 bg-responsibility min-h-[50svh]">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Unable to Load Members</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            We couldn't retrieve the member list. Please try again later.
          </p>
        </div>
      </main>
    );
  }

  const users = response?.data || [];

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

  if (Data.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center gap-6 padding py-24 bg-responsibility min-h-[50svh]">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
          <SearchX className="w-10 h-10 text-blue-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">No Members Found</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            There are no registered members to display at this time.
          </p>
        </div>
      </main>
    );
  }

  return <AboutPage Data={Data} />;
}
