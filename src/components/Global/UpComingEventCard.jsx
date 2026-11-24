"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import cn from "@/lib/cn.js";

const UpComingEventCard = ({ data, clName }) => {
  // The Event schema defaults `image` to `''`, and the public projection passes
  // it through unchanged, so `data.img` is often an empty string. React warns
  // on `src=""`, and a broken image leaves the picture section blank, so the
  // image is only rendered when there is a usable URL and a placeholder holds
  // the slot otherwise.
  const imageUrl = typeof data?.img === "string" ? data.img.trim() : "";

  return (
    <main
      className={cn(
        "relative grid md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 mxl:grid-cols-8 mmmxl:grid-cols-10 gap-7 lg:gap-5 mmmxl:gap-10 cursor-default overflow-hidden",
        clName,
      )}
    >
      {/* Picture Section */}
      <section className="md:col-span-3 lg:col-span-4 xl:col-span-3 mxl:col-span-3 mmmxl:col-span-3 overflow-hidden">
        {imageUrl ? (
          <img
            className="h-auto max-h-[28rem] min-h-[14rem] w-full object-cover"
            src={imageUrl}
            alt={data?.alt}
          />
        ) : (
          <div className="flex h-auto max-h-[28rem] min-h-[14rem] w-full items-center justify-center bg-black/30 text-sm font-bold uppercase tracking-wider text-white/60">
            No image
          </div>
        )}

        <div className="h-[4%] bg-black/50"></div>
      </section>
      {/* Picture Section End*/}

      {/* Content Section */}
      <section className="h-full md:col-span-3 lg:col-span-3 xl:col-span-5 mxl:col-span-5 mmmxl:col-span-4 flex flex-col items-start gap-4">
        {/* `startAt`/`endAt` are the mapper's names — `toPublicEvent` reads the
            document's `eventStartAt`/`eventEndAt` and renames them, so no schema
            field reaches this component. */}
        <TimeBox startAt={data?.startAt} endAt={data?.endAt} />
        <h1 className="text-2xl lg:text-3xl xl:text-4xl  font-semibold lg:line-clamp-none">
          {`"`}
          {data?.eventHeadLine1}
          {`"`}
        </h1>
        <p className="font-[450] text-xl lg:line-clamp-3">
          {data?.textContext}
        </p>

        {/* reward */}
        <h1 className="text-3xl hidden lg:block font-semibold lg:line-clamp-1">
          {data?.eventHeadLine2}
        </h1>
        <p className="font-[450] text-2xl hidden lg:block lg:line-clamp-3">
          {data?.reward}
        </p>

        <h1 className="text-2xl hidden lg:hidden mmmxl:hidden font-semibold lg:line-clamp-1">
          {data?.eventHeadLine3}
        </h1>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules1}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules2}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules3}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules4}
        </p>

        {/*
          Primary & Action Buttons:
          "View details" is placed prominently on top as requested.
          The two action buttons (btnLink and btnLink1) are placed underneath.
        */}
        {data?.id ? (
          <Link href={`/event/${data.id}`} className="inline-flex">
            <button
              type="button"
              className="bg-black/30 text-white font-bold uppercase px-4 sm:px-5 py-2 text-sm sm:text-base hover:text-gray-600 hover:bg-white border-[2.5px] sm:border-[3px] border-white transition-all duration-300 shadow-md"
            >
              {data?.participationEnabled ? "View details & register" : "View details"}
            </button>
          </Link>
        ) : null}

        {(data?.btnLink || data?.btnLink1) ? (
          <div className="flex flex-wrap items-center gap-3">
            {data?.btnLink ? (
              <a
                href={data.btnLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <button
                  type="button"
                  className="bg-black/30 text-white font-bold uppercase px-4 sm:px-5 py-2 text-sm sm:text-base hover:text-gray-600 hover:bg-white border-[2.5px] sm:border-[3px] border-white transition-all duration-300 shadow-md"
                >
                  {data?.btnText || "Learn More"}
                </button>
              </a>
            ) : null}

            {data?.btnLink1 ? (
              <a
                href={data.btnLink1}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <button
                  type="button"
                  className="bg-black/30 text-white font-bold uppercase px-4 sm:px-5 py-2 text-sm sm:text-base hover:text-gray-600 hover:bg-white border-[2.5px] sm:border-[3px] border-white transition-all duration-300 shadow-md"
                >
                  {data?.btnText1 || "More Info"}
                </button>
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* 3rd column - only for mmmxl - 1750px and up */}
      <section className="hidden mmmxl:flex relative py-3  h-full md:col-span-3 lg:col-span-3 xl:col-span-5 mxl:col-span-5 mmmxl:col-span-3 flex-col items-start gap-4">
        <h1 className="text-2xl hidden lg:hidden mmmxl:block py-4 font-semibold lg:line-clamp-1">
          {data?.eventHeadLine3}
        </h1>
        <p className="font-[450] text-xl hidden lg:hidden  mmmxl:block py-3lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules1}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden  mmmxl:block py-3 lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules2}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden mmmxl:block py-3 lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules3}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden mmmxl:block py-3 lg:line-clamp-3">
          {" 🔶 "}
          {data?.rules4}
        </p>
      </section>

      {/* Content Section End */}
    </main>
  );
};

export default UpComingEventCard;

function TimeBox({ startAt, endAt }) {
  const getEventStatus = () => {
    const startTime = new Date(startAt).getTime();
    // A missing end falls back to the start, so a single-instant record counts
    // as already ended rather than ticking a counter against an unknown window.
    const endTime = new Date(endAt || startAt).getTime();
    const now = Date.now();

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return { phase: "ended", timeLeft: null };
    }

    if (now >= startTime && now <= endTime) {
      return {
        phase: "running",
        timeLeft: getTimeLeft(endTime - now),
      };
    }

    if (now < startTime) {
      return {
        phase: "remaining",
        timeLeft: getTimeLeft(startTime - now),
      };
    }

    return { phase: "ended", timeLeft: null };
  };

  const getTimeLeft = (difference) => {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  const [status, setStatus] = useState(null);

  useEffect(() => {
    const update = () => setStatus(getEventStatus());

    update();
    const timer = setInterval(update, 1000);

    return () => clearInterval(timer);
  }, [startAt, endAt]);

  if (!status) {
    return (
      <main className="flex gap-5">
        <section className="flex flex-col items-center font-bold gap-1">
          <div className="border text-center px-5 py-2 font-bold text-2xl rounded-xl bg-black/70">
            Loading...
          </div>
        </section>
      </main>
    );
  }

  if (status.phase === "ended") {
    return (
      <main className="flex gap-5">
        <section className="flex flex-col items-center font-bold gap-1">
          <div className="border text-center px-5 py-2 font-bold text-2xl rounded-xl bg-black/70">
            Ended
          </div>
        </section>
      </main>
    );
  }

  const { timeLeft } = status;
  const { days, hours, minutes, seconds } = timeLeft;
  const phaseLabel = status.phase === "running" ? "Running" : "Remaining";

  return (
    <main className="flex flex-wrap items-center gap-2 sm:gap-4 md:gap-5">
      <section className="flex flex-col items-center font-bold gap-1">
        <div className="text-xs sm:text-sm">Days</div>
        <div className="border text-center px-2.5 sm:px-3 py-1 font-bold text-base sm:text-xl bg-black/70">
          {days}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div className="text-xs sm:text-sm">Hr</div>
        <div className="border text-center px-2.5 sm:px-3 py-1 font-bold text-base sm:text-xl bg-black/70">
          {hours}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div className="text-xs sm:text-sm">Min</div>
        <div className="border text-center px-2.5 sm:px-3 py-1 font-bold text-base sm:text-xl bg-black/70">
          {minutes}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div className="text-xs sm:text-sm">Sec</div>
        <div className="border text-center px-2.5 sm:px-3 py-1 font-bold text-base sm:text-xl bg-black/70">
          {seconds}
        </div>
      </section>

      <p className="self-end font-bold text-sm sm:text-lg lg:text-xl hidden sm:block">{phaseLabel}</p>
    </main>
  );
}
