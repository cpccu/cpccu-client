"use client";

import { Skeleton } from "@/components/ui/skeleton";
import DonatorCard from "@/components/DONATORS/DonatorCard";
import DonatorsData from "@/data/donators.json";
import { FaHeart } from "react-icons/fa";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicDonator } from "@/lib/public-content";

export default function DonatorsPage() {
  const { data: donatorsResponse, isLoading, isError } = useGetPublicContentQuery("donators");
  const donators = chooseLiveItems(
    donatorsResponse,
    DonatorsData,
    toPublicDonator,
    isLoading,
    isError,
  );

  if (donators === null) {
    return (
      <main className="bg-white py-16 md:py-20">
        <section className="padding mb-12">
          <div className="text-center mb-8">
            <p className="text-header font-mono text-sm font-semibold mb-2 tracking-wide uppercase">
              // our supporters
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 flex items-center justify-center gap-2">
              <FaHeart className="text-red-500" size={32} />
              Our Generous Donators
              <FaHeart className="text-red-500" size={32} />
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              We are grateful to these organizations and individuals who have generously
              supported CPCCU's mission to promote competitive programming and technical excellence.
            </p>
          </div>
        </section>
        <section className="padding">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
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
    <main className="bg-white py-16 md:py-20">
      {/* Header Section */}
      <section className="padding mb-12">
        <div className="text-center mb-8">
          <p className="text-header font-mono text-sm font-semibold mb-2 tracking-wide uppercase">
            // our supporters
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 flex items-center justify-center gap-2">
            <FaHeart className="text-red-500" size={32} />
            Our Generous Donators
            <FaHeart className="text-red-500" size={32} />
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            We are grateful to these organizations and individuals who have generously 
            supported CPCCU's mission to promote competitive programming and technical excellence.
          </p>
        </div>


      </section>

      {/* Donators Grid */}
      <section className="padding">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {donators.map((donator) => (
            <DonatorCard key={donator.id} donator={donator} />
          ))}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="padding mt-16 bg-gradient-to-r from-header/5 to-blue-50 rounded-2xl py-12 text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">
          Interested in Supporting CPCCU?
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto mb-6">
          Your donation helps us organize better events, provide scholarships, 
          and create opportunities for students to excel in competitive programming.
        </p>
        <a
          href="mailto:cpccu.club@gmail.com?subject=Donation%20Inquiry"
          className="inline-block bg-header text-white font-semibold px-8 py-3 rounded-lg hover:bg-header/90 transition-all duration-300"
        >
          Get in Touch
        </a>
      </section>

      {/* Appreciation Section */}
      <section className="padding mt-12 text-center">
        <p className="text-gray-600 text-lg">
          <span className="font-bold text-header">Thank you</span> for believing in our vision 
          and helping us make a difference in the competitive programming community!
        </p>
      </section>
    </main>
  );
}
