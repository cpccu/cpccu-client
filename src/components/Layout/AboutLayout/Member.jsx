"use client";
// import committee from "@/data/Committee.json";
// import alumni from "@/data/Alumni.json";
import AboutPage from "@/components/ABOUT/AboutPage";
import { useFetchMembersQuery } from "@/features/members/memberApi";

export default function Member() {
  const { data: response, isLoading, isError } = useFetchMembersQuery();
  const users = response?.data || [];
  console.log("users => ", users)

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isError) {
    return <div>Error loading members.</div>;
  }
  const committee = users.filter(user => user.roles.role === "committee");
  const alumni = users.filter(user => user.roles.role === "alumni");
  const members = users.filter(user => user.roles.role === "member");

  const Data = [...committee, ...alumni, ...members];

  return <AboutPage Data={Data} />;
}
