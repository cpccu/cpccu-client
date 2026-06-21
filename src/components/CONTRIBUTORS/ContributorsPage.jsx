"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FaCode, FaHeart, FaGithub } from "react-icons/fa";
import ContributorCard from "./ContributorCard";
import contributorsData from "@/data/contributors.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicContributor } from "@/lib/public-content";

export default function ContributorsPage() {
  const { data: contributorsResponse, isLoading, isError } = useGetPublicContentQuery("contributors");
  const contributors = chooseLiveItems(
    contributorsResponse,
    contributorsData,
    toPublicContributor,
    isLoading,
    isError,
  );

  if (contributors === null) {
    return (
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-header via-blue-950 to-blue-800 text-white padding py-16 md:py-24 relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-mono">
              <FaCode size={14} />
              <span>// meet the team</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
              Our Contributors
            </h1>
            <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
              The talented developers and designers who built and maintain the CPCCU
              portal. Every line of code, every pixel — crafted with passion.
            </p>
          </div>
        </section>
        <section className="bg-gray-50 border-b border-gray-200 padding py-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-4 w-32 mt-1 mx-auto" />
            </div>
          </div>
        </section>
        <section className="padding py-14 md:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Meet the Builders
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              These are the people who dedicated their time and skills to make the
              CPCCU platform a reality.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col items-center gap-3 text-center">
                <Skeleton className="w-40 h-40 rounded-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full mt-2" />
                <div className="flex gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-header via-blue-950 to-blue-800 text-white padding py-16 md:py-24 relative overflow-hidden">
        {/* Background decorative code pattern */}
        <div className="absolute inset-0 opacity-5 select-none pointer-events-none overflow-hidden">
          <pre className="text-xs leading-5 text-white font-mono whitespace-pre-wrap break-all">
            {`function buildCPCCU() {
  const team = [];
  const passion = Infinity;
  while (passion > 0) {
    team.push(new Contributor());
    code(); debug(); deploy();
  }
  return team.map(c => c.contribute());
}
const cpccu = buildCPCCU();
// Built with ❤️ by amazing contributors`}
          </pre>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center gap-5">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-mono">
            <FaCode size={14} />
            <span>// meet the team</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
            Our Contributors
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-2xl leading-relaxed">
            The talented developers and designers who built and maintain the CPCCU
            portal. Every line of code, every pixel — crafted with passion.
          </p>
          {/* <div className="flex items-center gap-2 text-white/70 text-sm font-mono mt-2">
            <FaHeart size={12} className="text-pink-300" />
            <span>{contributorsData.length} contributors </span>
          </div> */}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-50 border-b border-gray-200 padding py-6">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          <StatItem label="Total Contributors" value={contributors.length} />
          {/* <StatItem label="Lines of Code" value="10k+" /> */}
        </div>
      </section>

      {/* Contributors Grid */}
      <section className="padding py-14 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Meet the Builders
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            These are the people who dedicated their time and skills to make the
            CPCCU platform a reality.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {contributors.map((contributor) => (
            <ContributorCard key={contributor.id} contributor={contributor} />
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="padding py-14 bg-gradient-to-r from-header/5 to-blue-50 border-t border-header/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Want to Contribute?
            </h3>
            <p className="text-gray-600 max-w-lg">
              We welcome contributions from all CSE students. Whether it&apos;s a
              bug fix, new feature, or documentation — every contribution counts.
            </p>
          </div>
          <a
            href="https://github.com/cpccu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-8 py-4 bg-gray-900 hover:bg-header text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-header/30 whitespace-nowrap"
          >
            <FaGithub size={20} />
            <span>Contribute on GitHub</span>
          </a>
        </div>
      </section>
    </main>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-2xl md:text-3xl font-extrabold text-header">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
