"use client";
// import committee from "@/data/Committee.json";
// import alumni from "@/data/Alumni.json";
import AboutPage from "@/components/ABOUT/AboutPage";
import { useFetchMembersQuery } from "@/features/members/memberApi";

export default function Member() {
  const { data: response, isLoading, isError } = useFetchMembersQuery();
  const users = response?.data || [];

  if (isLoading) {
    return <div>Loading...</div>;
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
