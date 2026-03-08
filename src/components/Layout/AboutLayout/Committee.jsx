"use client";
import AboutPage from "@/components/ABOUT/AboutPage";
import { useFetchMembersQuery } from "@/features/members/memberApi";
// import Data from "@/data/Committee.json";


export default function Committee() {
  const { data, isLoading, isError } = useFetchMembersQuery();
  console.log("Fetched members data from Committee.jsx:", data); // Log the fetched data
  const committee = data?.data.filter(user => user.roles.role === "committee") || [];

  if (isError) {
    return <div>Error loading committee members.</div>;
  }
  if (isLoading) {
    return <div>Loading...</div>;
  }
  return <AboutPage Data={committee} />;
}