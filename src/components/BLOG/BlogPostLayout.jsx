"use client";

import React, { useContext, useEffect, useState, useCallback } from "react";
import BlogMainCard from "@/components/BLOG/BlogMainCard";
import BlogScroll from "@/Context/BlogScroll/BlogScroll";
import FilterBtn from "@/data/blog/blogFilter.json";
import res from "@/data/BlogPost.json";
import Pagination from "@/components/Global/Pagination";

export default function BlogPostLayout() {
  const { setBlogTarget } = useContext(BlogScroll);
  const [Tag, setTag] = useState("all");
  const [Data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [rows, setRows] = useState([]);

  const pageItem = 9;

  // Filter data based on the selected tag
  const filterData = useCallback(() => {
    const filteredData =
      Tag === "all"
        ? res
        : res.filter((item) => item.tag.split(" ").includes(Tag));
    setData(filteredData);
    setCurrentPage(0); // Reset to the first page when tag changes
  }, [Tag]);

  useEffect(() => {
    filterData();
  }, [filterData]);

  useEffect(() => {
    setBlogTarget("blogMainLayout");
  }, [setBlogTarget]);

  useEffect(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    const rows = Data.slice(startIdx, endIdx);
    setRows(rows);
  }, [Data, currentPage]);

  return (
    <section id="blogMainLayout" className="bg-responsibility py-7 md:py-12">
      {/* filter data start */}
      <div className="font-semibold text-sm md:text-lg flex flex-wrap items-center justify-center gap-3 md:gap-5 lg:gap-7 py-7 md:py-14">
        {FilterBtn.map((item, index) => (
          <button
            onClick={() => setTag(item?.tag)}
            key={index}
            className={`
            ${
              item?.tag.toLowerCase() === Tag.toLowerCase()
                ? "bg-header text-white"
                : "bg-header/15"
            } shrink-0 md:block px-2 md:px-6 lg:px-8 py-2 hover:bg-header hover:text-white trans capitalize`}
          >
            {item.btnText}
          </button>
        ))}
      </div>
      {/* filter data end */}

      {/* card start */}
      <main className="py-5 md:py-10 px-[.5em] md:px-[1.5em] lg:px-[2.9em] xl:px-[7em] grid md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-7">
        {rows.map((item, index) => (
          <BlogMainCard key={index} Data={item} />
        ))}
      </main>
      {/* card end */}

      {/* start pagination */}
      <Pagination
        currentPage={currentPage}
        pageCount={Math.ceil(Data.length / pageItem)}
        onPageChange={setCurrentPage}
      />
      {/* end pagination */}
    </section>
  );
}
