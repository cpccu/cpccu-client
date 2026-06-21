"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import GalleryCard from "@/components/Global/GalleryCard";
import tabBtn from "@/data/home/GallerySection.json";
import res from "@/data/GallaryCard.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicGalleryItem } from "@/lib/public-content";

export default function GallerySection() {
  const [Tag, setTag] = useState("all");
  const { data: galleryResponse, isLoading, isError } = useGetPublicContentQuery("gallery");
  const galleryItems = chooseLiveItems(galleryResponse, res, toPublicGalleryItem, isLoading, isError);
  const Data = useMemo(
    () => galleryItems === null ? [] : galleryItems.filter((item) =>
      item.tag.split(" ").includes(Tag)
    ),
    [Tag, galleryItems],
  );

  if (galleryItems === null) {
    return (
      <section className="bg-responsibility padding py-14 md:py-20 lg:py-24">
        <h1 className="text-center text-3xl md:text-4xl font-bold text-gray-800 capitalize">
          {tabBtn?.header}
        </h1>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

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
