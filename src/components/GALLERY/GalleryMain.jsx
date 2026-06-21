"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import GalleryCard from "@/components/Global/GalleryCard";
import GalleryScroll from "@/Context/GalleryScroll/GalleryScroll";
import Data from "@/data/GalleryBodyCard.json";
import Pagination from "@/components/Global/Pagination";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicGalleryItem, groupGalleryItemsByEvent } from "@/lib/public-content";

export default function GalleryMain() {
  const { setScrollTarget } = useContext(GalleryScroll);

  const [currentPage, setCurrentPage] = useState(0);
  const { data: galleryResponse, isLoading: galleryLoading, isError: galleryError } = useGetPublicContentQuery("gallery");
  const { data: eventsResponse, isLoading: eventsLoading, isError: eventsError } = useGetPublicContentQuery("gallery-events");

  // All hooks must be called before any conditional return
  const liveGalleryItems = useMemo(() => {
    if (galleryLoading || !galleryResponse?.data) return [];
    const items = galleryResponse.data;
    return Array.isArray(items) && items.length ? items.map(toPublicGalleryItem) : [];
  }, [galleryResponse, galleryLoading]);

  const liveEvents = useMemo(() => {
    if (eventsLoading || !eventsResponse?.data) return [];
    const items = eventsResponse.data;
    return Array.isArray(items) && items.length
      ? items.map((event) => ({
          id: event._id || event.id,
          title: event.title,
          description: event.description,
          eventDate: event.eventDate,
        }))
      : [];
  }, [eventsResponse, eventsLoading]);

  const eventMap = useMemo(() => {
    const map = {};
    liveEvents.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [liveEvents]);

  const gallerySections = useMemo(() => {
    if (!galleryError && liveGalleryItems.length > 0) {
      return groupGalleryItemsByEvent(liveGalleryItems, eventMap);
    }
    return Data;
  }, [liveGalleryItems, eventMap, galleryError]);

  useEffect(() => {
    setScrollTarget("gallery");
  }, [setScrollTarget]);

  const pageItem = 4;

  const rows = useMemo(() => {
    const startIdx = currentPage * pageItem;
    const endIdx = startIdx + pageItem;
    return gallerySections.slice(startIdx, endIdx);
  }, [currentPage, gallerySections]);

  if (galleryLoading || eventsLoading) {
    return (
      <main
        id="gallery"
        className="flex flex-col gap-14 md:gap-20 lg:gap-32 padding py-16 md:py-24 lg:py-32 bg-responsibility"
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="flex flex-col gap-12">
            <div className="flex flex-col gap-7 md:gap-10">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-4 w-full max-w-2xl" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="aspect-[4/3] w-full rounded-lg" />
              ))}
            </div>
          </section>
        ))}
        <div className="flex justify-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-full" />
          ))}
        </div>
      </main>
    );
  }

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
