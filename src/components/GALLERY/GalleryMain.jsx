"use client";

import { useContext, useEffect, useState } from "react";
import GalleryCard from "@/components/Global/GalleryCard";
import GalleryScroll from "@/Context/GalleryScroll/GalleryScroll";
import Data from "@/data/GalleryBodyCard.json";
import Pagination from "@/components/Global/Pagination";

export default function GalleryMain() {
  const { setScrollTarget } = useContext(GalleryScroll);

  const [currentPage, setCurrentPage] = useState(0);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    setScrollTarget("gallery");
  });

  const pageItem = 4;

  useEffect(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    const rows = Data.slice(startIdx, endIdx);
    setRows(rows);
  }, [currentPage]);

  return (
    <>
      <main
        id="gallery"
        className="flex flex-col gap-14 md:gap-20 lg:gap-32 pt-10 md:pt-20 lg:pt-32 padding"
      >
        {rows.map((item, index) => (
          <GalleryBodyCard key={index} data={item} />
        ))}
      </main>

      {/* start pagination  */}
      <Pagination
        currentPage={currentPage}
        pageCount={Math.ceil(Data.length / pageItem)}
        onPageChange={setCurrentPage}
      />
      {/* end pagination */}
    </>
  );
}

export function GalleryBodyCard({ data }) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-7 md:gap-10">
        <div>
          <span className="text-2xl md:text-4xl lg:text-5xl font-thin text-gray-600 border-b-2 pb-2 border-gray-700">
            {data?.header}
          </span>
        </div>
        <p className="text-gray-700 lg:text-lg">{data?.conText}</p>
      </div>
      <GalleryCard Data={data?.element} />
    </section>
  );
}
