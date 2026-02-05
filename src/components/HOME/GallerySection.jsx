"use client";

import GalleryCard from "@/components/Global/GalleryCard";
import tabBtn from "@/data/home/GallerySection.json";
import res from "@/data/GallaryCard.json";
import { useCallback, useEffect, useState } from "react";

export default function GallerySection() {
  const [Tag, setTag] = useState("all");
  const [Data, setData] = useState(null);

  const filterData = useCallback(() => {
    const filteredData = res.filter((item) =>
      item.tag.split(" ").includes(Tag)
    );
    setData(filteredData);
  }, [Tag]);

  useEffect(() => {
    filterData();
  }, [filterData]); // Call filterData when the component mounts or when filterData changes

  return (
    <section className="bg-responsibility padding py-14 md:py-20 lg:py-24">
      {/* Gallery section header */}
      <h1 className="text-center text-3xl md:text-4xl font-bold text-gray-800 capitalize">
        {tabBtn?.header}
      </h1>

      {/* Filter buttons */}
      <div className="font-semibold text-sm md:text-lg flex flex-wrap items-center justify-center gap-3 md:gap-5 lg:gap-7 py-7 md:py-14">
        {tabBtn?.element.map((item, index) => (
          <button
            onClick={() => setTag(item?.tag)}
            key={index}
            className={`${index === tabBtn.element.length - 1 ? "hidden" : ""}
            ${
              item?.tag.toLowerCase() == Tag.toLowerCase()
                ? "bg-header text-white"
                : "bg-header/15"
            } shrink-0 md:block px-2 md:px-6 lg:px-8 py-2  hover:bg-header hover:text-white trans capitalize`}
          >
            {item.btnText}
          </button>
        ))}
      </div>

      {/* Gallery cards start */}
      <GalleryCard Data={Data} />
      {/* Gallery cards end */}
    </section>
  );
}
