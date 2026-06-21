"use client";

import React, { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import UpComingEventCard from "@/components/Global/UpComingEventCard.jsx";
import "./Event.css";
import cn from "@/lib/cn.js";
import fallbackData from "@/data/upcomingEvent.json";
import { useGetPublicContentQuery } from "@/features/content/contentApi";
import { chooseLiveItems, toPublicEvent } from "@/lib/public-content";

const EventLayout = ({ clName }) => {
  const { data: eventsResponse, isLoading, isError } = useGetPublicContentQuery("events");

  if (isLoading || isError || !eventsResponse) {
    return (
      <div className={cn("text-white bg-header relative z-30 p-5 md:p-10 lg:p-12", clName)}>
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
        <section className="absolute bottom-2 right-2 flex gap-1">
          <div className="flex items-center justify-center px-5 py-2 bg-header-hover">
            <FontAwesomeIcon className="h-6" icon={faAngleLeft} />
          </div>
          <div className="flex items-center justify-center px-5 py-2 bg-header-hover">
            <FontAwesomeIcon className=" rotate-180 h-6" icon={faAngleLeft} />
          </div>
        </section>
        <section className="absolute -top-12 lg:-top-8 left-0 right-0 flex items-center justify-center lg:justify-end">
          <div className="text-2xl md:text-3xl font-bold text-gray-900 bg-white px-8 py-3 lg:mr-12 shadow-xl">
            Upcoming Event
          </div>
        </section>
      </div>
    );
  }

  return <EventLayoutContent eventsResponse={eventsResponse} clName={clName} />;
};

function EventLayoutContent({ eventsResponse, clName }) {
  const slider = useRef(null);
  const [slidePx, setSlidePx] = useState(0);
  const events = chooseLiveItems(eventsResponse, fallbackData, toPublicEvent, false, false);

  const firstEventStart = events[0]?.date ? new Date(events[0].date).getTime() : 0;
  const sectionLabel = firstEventStart && firstEventStart > Date.now() ? "Upcoming Event" : "Recent Event";

  const goLeft = () => {
    if (slider.current) {
      slider.current.scrollLeft -= slidePx;
    }
  };

  const goRight = () => {
    if (slider.current) {
      slider.current.scrollLeft += slidePx;
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (events.length && slider.current) {
        setSlidePx(slider.current.scrollWidth / events.length);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [events.length]);

  useEffect(() => {
    if (events.length && slider.current) {
      setSlidePx(slider.current.scrollWidth / events.length);
    }
  }, [events.length]);

  return events.length ? (
    <div
      className={cn(
        "text-white bg-header relative z-30 p-5 md:p-10 lg:p-12",
        clName
      )}
    >
      <section
        ref={slider}
        className="flex overflow-x-auto EventScroll scroll-smooth snap-mandatory snap-x"
      >
        {events.map((item, index) => (
          <div key={index} className="w-full shrink-0 snap-center">
            <UpComingEventCard data={item} />
          </div>
        ))}
      </section>

      <section className="absolute bottom-2 right-2 flex gap-1">
        <button
          onClick={goLeft}
          className="hover:bg-white flex items-center justify-center px-5 py-2 trans font-bold hover:text-gray-900 bg-header-hover"
        >
          <FontAwesomeIcon className="h-6" icon={faAngleLeft} />
        </button>
        <button
          onClick={goRight}
          className="hover:bg-white flex items-center justify-center px-5 py-2 trans font-bold hover:text-gray-900 bg-header-hover"
        >
          <FontAwesomeIcon className=" rotate-180 h-6" icon={faAngleLeft} />
        </button>
      </section>

      <section className="absolute -top-12 lg:-top-8 left-0 right-0 flex items-center justify-center lg:justify-end">
        <div className="text-2xl md:text-3xl font-bold text-gray-900 bg-white px-8 py-3 lg:mr-12 shadow-xl">
          {sectionLabel}
        </div>
      </section>
    </div>
  ) : null;
}

export default EventLayout;
