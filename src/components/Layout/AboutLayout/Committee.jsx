"use client";
import AboutPage from "@/components/ABOUT/AboutPage";
import PreviousCommittee from "@/components/ABOUT/PreviousCommittee";
import CommitteeData from "@/data/Committee.json";
import PreviousCommitteeData from "@/data/PreviousCommittee.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";

export default function Committee() {
  const { data: response } = useGetPublicContentQuery("committees");
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
