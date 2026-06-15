"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import GalleryCard from "@/components/Global/GalleryCard";
import GalleryScroll from "@/Context/GalleryScroll/GalleryScroll";
import Data from "@/data/GalleryBodyCard.json";
import Pagination from "@/components/Global/Pagination";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicGalleryItem, groupGalleryItemsByEvent } from "@/lib/public-content";

export default function GalleryMain() {
  const { setScrollTarget } = useContext(GalleryScroll);

  const [currentPage, setCurrentPage] = useState(0);
  const { data: galleryResponse } = useGetPublicContentQuery("gallery");
  const { data: eventsResponse } = useGetPublicContentQuery("gallery-events");
  
  const liveGalleryItems = chooseLiveItems(galleryResponse, [], toPublicGalleryItem);
  const liveEvents = chooseLiveItems(eventsResponse, [], (event) => ({
    id: event._id || event.id,
    title: event.title,
    description: event.description,
    eventDate: event.eventDate,
  }));
  
  const eventMap = useMemo(() => {
    const map = {};
    liveEvents.forEach(event => {
      map[event.id] = event;
    });
    return map;
  }, [liveEvents]);

  const gallerySections = useMemo(() => {
    if (liveGalleryItems.length > 0) {
      return groupGalleryItemsByEvent(liveGalleryItems, eventMap);
    }
    return Data;
  }, [liveGalleryItems, eventMap]);

  useEffect(() => {
    setScrollTarget("gallery");
  }, []);

  const pageItem = 4;

  const rows = useMemo(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    return gallerySections.slice(startIdx, endIdx);
  }, [currentPage, gallerySections]);

  return (
    <main
      id="gallery"
      className="flex flex-col gap-14 md:gap-20 lg:gap-32 padding py-16 md:py-24 lg:py-32 bg-responsibility"
    >
      {rows.map((item, index) => (
        <GalleryBodyCard key={index} data={item} />
      ))}

      <Pagination
        currentPage={currentPage}
        pageCount={Math.ceil(gallerySections.length / pageItem)}
        onPageChange={setCurrentPage}
      />
    </main>
  );
}

export function GalleryBodyCard({ data }) {
  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-7 md:gap-10">
        <div>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-header border-b-2 pb-2 inline-block">
            {data?.header}
          </h2>
        </div>
        <p className="text-p-text lg:text-lg conText">{data?.conText}</p>
      </div>
      <GalleryCard Data={data?.element} />
    </section>
  );
}
