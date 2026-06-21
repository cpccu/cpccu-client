"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import UpComingEventCard from "@/components/Global/UpComingEventCard";
import Data from "@/data/upcomingEvent.json";
import EventScroll from "@/Context/EventScroll/EventScroll";
import Pagination from "@/components/Global/Pagination";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicEvent } from "@/lib/public-content";

export default function NoticeSection() {
  const { setScrollTarget } = useContext(EventScroll);
  const [currentPage, setCurrentPage] = useState(0);
  const { data: eventsResponse, isLoading, isError } = useGetPublicContentQuery("events");
  const events = chooseLiveItems(eventsResponse, Data, toPublicEvent, isLoading, isError);

  useEffect(() => {
    setScrollTarget("eventMain");
  }, []);

  const pageItem = 4;

  const rows = useMemo(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    return events.slice(startIdx, endIdx);
  }, [events, currentPage, pageItem]);

  if (events === null) {
    return (
      <section className="bg-responsibility">
        <main
          id="eventMain"
          className="py-12 px-[.5em] md:px-[1.5em] lg:px-[2.9em] xl:px-[7em]"
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <section
              key={i}
              className="bg-header text-white p-5 md:p-8 lg:p-12 my-5 md:my-8 lg:my-12"
            >
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                <div className="flex flex-col gap-4 flex-1">
                  <Skeleton className="h-6 w-3/4 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/20" />
                  <Skeleton className="h-4 w-2/3 bg-white/20" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-10 w-32 bg-white/20" />
                    <Skeleton className="h-10 w-32 bg-white/20" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:w-1/3">
                  <Skeleton className="h-5 w-1/2 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/20" />
                  <Skeleton className="h-4 w-4/5 bg-white/20" />
                  <Skeleton className="h-4 w-3/5 bg-white/20" />
                </div>
              </div>
            </section>
          ))}
        </main>
        <div className="flex justify-center gap-2 pb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-full" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-responsibility">
      <main
        id="eventMain"
        className="py-12 px-[.5em] md:px-[1.5em] lg:px-[2.9em] xl:px-[7em]"
      >
        {rows.map((item, index) => (
          <section
            key={index}
            className="bg-header text-white p-5 md:p-8 lg:p-12 my-5 md:my-8 lg:my-12"
          >
            <UpComingEventCard data={item} />
          </section>
        ))}
      </main>
      {/* start pagination  */}
      <Pagination
        currentPage={currentPage}
        pageCount={Math.ceil(events.length / pageItem)}
        onPageChange={setCurrentPage}
      />
      {/* end pagination */}
    </section>
  );
}
