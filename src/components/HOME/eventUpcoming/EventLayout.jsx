import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import UpComingEventCard from "../../Global/UpComingEventCard.jsx";
import "./Event.css";
import cn from "./../../../../lib/cn.js";
import data from "./../../../../data/upcomingEvent.json";

const EventLayout = ({ clName }) => {
  const slider = useRef(null);
  const [slidePx, setSlidePx] = useState(0);

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
      if (data) {
        setSlidePx(slider.current.scrollWidth / data.length);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data]);

  useEffect(() => {
    if (data) {
      setSlidePx(slider.current.scrollWidth / data.length);
    }
  }, [data]);

  return data ? (
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
        {data.map((item, index) => (
          <div key={index} className="w-full shrink-0 snap-center">
            <UpComingEventCard data={item} />
          </div>
        ))}
      </section>

      <section className="absolute bottom-2 right-2 flex gap-1">
        <button
          onClick={goLeft}
          className="hover:bg-white flex items-center justify-center px-5 py-2 trans font-bold hover:text-gray-900 bg-headerHover"
        >
          <FontAwesomeIcon className="h-6" icon={faAngleLeft} />
        </button>
        <button
          onClick={goRight}
          className="hover:bg-white flex items-center justify-center px-5 py-2 trans font-bold hover:text-gray-900 bg-headerHover"
        >
          <FontAwesomeIcon className=" rotate-180 h-6" icon={faAngleLeft} />
        </button>
      </section>

      {data.map((item, index) => (
          item?.date < new Date() ? (
            <section className="absolute -top-12 lg:-top-8 left-0 right-0 flex items-center justify-center lg:justify-end">
        <div className="text-2xl md:text-3xl font-bold text-gray-900 bg-white px-8 py-3 lg:mr-12  shadow-xl">
          Upcoming Event
        </div>
      </section>
      ) : (
        <section className="absolute -top-12 lg:-top-8 left-0 right-0 flex items-center justify-center lg:justify-end">
        <div className="text-2xl md:text-3xl font-bold text-gray-900 bg-white px-8 py-3 lg:mr-12  shadow-xl">
          Recent Event
        </div>
      </section>
      )
      ))}
    </div>
  ) : null;
};

export default EventLayout;
