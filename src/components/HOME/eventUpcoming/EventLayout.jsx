"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import UpComingEventCard from "@/components/Global/UpComingEventCard.jsx";
import "./Event.css";
import cn from "@/lib/cn.js";
import fallbackData from "@/data/upcomingEvent.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicEvent } from "@/lib/public-content";

const EventLayout = ({ clName }) => {
  const { data: eventsResponse, isLoading, isError } =
    useGetPublicContentQuery("events");

  if (isLoading || isError || !eventsResponse) {
    return (
      <div
        className={cn(
          "home-event-card relative z-30 p-5 sm:p-6 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl border border-blue-500/20 bg-gradient-to-br from-[#0c1838]/95 via-[#0f224f]/90 to-[#081229]/95 shadow-2xl backdrop-blur-xl text-white",
          clName
        )}
      >
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          <Skeleton className="h-7 w-36 rounded-full bg-white/10" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
            <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <Skeleton className="lg:col-span-4 xl:col-span-3 aspect-[16/10] sm:aspect-[4/3] lg:h-[22rem] w-full rounded-2xl bg-white/10" />
          <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-5">
            <Skeleton className="h-6 w-32 rounded-full bg-white/10" />
            <Skeleton className="h-8 w-3/4 rounded-lg bg-white/10" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <Skeleton className="h-4 w-2/3 rounded bg-white/10" />
            <Skeleton className="h-16 w-full rounded-xl bg-white/10 mt-2" />
            <Skeleton className="h-11 w-44 rounded-xl bg-white/10 mt-2" />
          </div>
          <Skeleton className="lg:col-span-3 xl:col-span-4 h-56 rounded-2xl bg-white/10" />
        </div>
      </div>
    );
  }

  return <EventLayoutContent eventsResponse={eventsResponse} clName={clName} />;
};

function EventLayoutContent({ eventsResponse, clName }) {
  const slider = useRef(null);
  const [slidePx, setSlidePx] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const allEvents = chooseLiveItems(
    eventsResponse,
    fallbackData,
    toPublicEvent,
    false,
    false
  );

  // All events sorted newest first
  const events = [...allEvents].sort(
    (a, b) => new Date(b.startAt || 0) - new Date(a.startAt || 0)
  );

  const firstEventStart = events[0]?.startAt
    ? new Date(events[0].startAt).getTime()
    : 0;
  const sectionLabel =
    firstEventStart && firstEventStart > Date.now()
      ? "Upcoming Event"
      : "Recent Event";

  const calculateSlidePx = useCallback(() => {
    if (events.length && slider.current) {
      setSlidePx(slider.current.scrollWidth / events.length);
    }
  }, [events.length]);

  const updateIndexFromScroll = useCallback(() => {
    if (!slider.current || !events.length) return;
    const width = slider.current.clientWidth || 1;
    const scrollLeft = slider.current.scrollLeft;
    const index = Math.round(scrollLeft / width);
    setCurrentIndex(Math.min(Math.max(index, 0), events.length - 1));
  }, [events.length]);

  const goLeft = () => {
    if (slider.current) {
      slider.current.scrollBy({ left: -slider.current.clientWidth, behavior: "smooth" });
    }
  };

  const goRight = () => {
    if (slider.current) {
      slider.current.scrollBy({ left: slider.current.clientWidth, behavior: "smooth" });
    }
  };

  const goToSlide = (index) => {
    if (slider.current) {
      slider.current.scrollTo({
        left: index * slider.current.clientWidth,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  useEffect(() => {
    calculateSlidePx();
    window.addEventListener("resize", calculateSlidePx);
    return () => window.removeEventListener("resize", calculateSlidePx);
  }, [calculateSlidePx]);

  useEffect(() => {
    const el = slider.current;
    if (!el) return;
    let timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateIndexFromScroll, 60);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timeout);
      el.removeEventListener("scroll", onScroll);
    };
  }, [updateIndexFromScroll]);

  return events.length ? (
    <div
      className={cn(
        "home-event-card relative z-30 p-5 sm:p-6 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0c1838]/95 via-[#0f224f]/90 to-[#081229]/95 shadow-2xl shadow-blue-950/60 backdrop-blur-xl overflow-hidden text-white",
        clName
      )}
    >
      {/* Subtle tech background glows */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row with Section Label & Controls */}
      <div className="relative z-10 flex items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 font-mono text-xs uppercase tracking-wider backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>{sectionLabel}</span>
        </div>

        {events.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 select-none">
              {currentIndex + 1} / {events.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goLeft}
                type="button"
                aria-label="Previous event"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={goRight}
                type="button"
                aria-label="Next event"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Carousel Track */}
      <section
        ref={slider}
        className="relative z-10 flex overflow-x-auto EventScroll scroll-smooth snap-mandatory snap-x"
      >
        {events.map((item, index) => (
          <div key={item.id || index} className="w-full shrink-0 snap-center">
            <UpComingEventCard data={item} />
          </div>
        ))}
      </section>

      {/* Dot Indicators */}
      {events.length > 1 && (
        <div className="relative z-10 flex justify-center items-center gap-1.5 mt-6 pt-2">
          {events.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              type="button"
              aria-label={`Go to event slide ${idx + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                idx === currentIndex
                  ? "w-6 bg-blue-500 shadow-sm shadow-blue-500/50"
                  : "w-1.5 bg-white/20 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;
}

export default EventLayout;
