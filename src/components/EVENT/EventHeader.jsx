"use client";

import { useContext } from "react";
import { Link as ScrollEvent } from "react-scroll";
import EventScroll from "@/Context/EventScroll/EventScroll";
import Data from "@/data/event/event.json";

export default function EventHeader() {
  const { scrollTarget } = useContext(EventScroll);

  return (
    <header
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.8)), url(${Data?.bgURL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      className="padding flex flex-col items-center justify-center py-20 md:py-24 lg:py-28 gap-4 text-white"
    >
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold shrink-0 capitalize">
        {Data?.header}
      </h1>
      <p>{Data?.conText}</p>

      <ScrollEvent
        to={scrollTarget || ""}
        spy={true}
        smooth={true}
        offset={-50}
        duration={900}
        animate={{ duration: 900, easing: "easeInOutCubic" }}
      >
        <button className="py-3 px-12 font-bold uppercase bg-header hover:bg-white hover:text-gray-700 trans mt-5">
          {Data?.btnText}
        </button>
        {/* target to scroll */}
      </ScrollEvent>
    </header>
  );
}
