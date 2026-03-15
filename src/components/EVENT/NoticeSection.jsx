"use client";

import { useContext, useEffect, useState } from "react";
import UpComingEventCard from "@/components/Global/UpComingEventCard";
import Data from "@/data/upcomingEvent.json";
import EventScroll from "@/Context/EventScroll/EventScroll";
import Pagination from "@/components/Global/Pagination";

export default function NoticeSection() {
  const { setScrollTarget } = useContext(EventScroll);
  const [currentPage, setCurrentPage] = useState(0);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setScrollTarget("eventMain");
  }, []);

  const pageItem = 4;

  useEffect(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    const rows = Data.slice(startIdx, endIdx);
    setRows(rows);
  }, [Data, currentPage, pageItem]);

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
        pageCount={Math.ceil(Data.length / pageItem)}
        onPageChange={setCurrentPage}
      />
      {/* end pagination */}
    </section>
  );
}
