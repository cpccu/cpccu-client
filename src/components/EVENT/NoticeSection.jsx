"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import UpComingEventCard from "@/components/Global/UpComingEventCard";
import Data from "@/data/upcomingEvent.json";
import EventScroll from "@/Context/EventScroll/EventScroll";
import Pagination from "@/components/Global/Pagination";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicEvent } from "@/lib/public-content";

export default function NoticeSection() {
  const { setScrollTarget } = useContext(EventScroll);
  const [currentPage, setCurrentPage] = useState(0);
  const { data: eventsResponse } = useGetPublicContentQuery("events");
  const events = chooseLiveItems(eventsResponse, Data, toPublicEvent);

  useEffect(() => {
    setScrollTarget("eventMain");
  }, []);

  const pageItem = 4;

  const rows = useMemo(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    return events.slice(startIdx, endIdx);
  }, [events, currentPage, pageItem]);

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
