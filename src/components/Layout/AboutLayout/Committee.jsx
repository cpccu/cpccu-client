"use client";
import AboutPage from "@/components/ABOUT/AboutPage";
import PreviousCommittee from "@/components/ABOUT/PreviousCommittee";
import CommitteeData from "@/data/Committee.json";

export default function Committee() {
  const committee = CommitteeData || [];

  return (
    <>
      <section>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 padding py-8 text-center">Current Committee</h2>
        <AboutPage Data={committee} />
      </section>
      <PreviousCommittee />
    </>
  );
}