"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import cn from "@/lib/cn.js";

const UpComingEventCard = ({ data, clName }) => {
  return (
    <main
      className={cn(
        "relative grid md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 mxl:grid-cols-8 mmmxl:grid-cols-10 gap-7 lg:gap-5 mmmxl:gap-10 cursor-default overflow-hidden",
        clName,
      )}
    >
      {/* Picture Section */}
      <section className="md:col-span-3 lg:col-span-4 xl:col-span-3 mxl:col-span-3 mmmxl:col-span-3 overflow-hidden">
        <img
          className="h-auto max-h-[28rem] min-h-[14rem] w-full object-cover"
          src={data?.img}
          alt={data?.alt}
        />

        <div className="h-[4%] bg-black/50"></div>
      </section>
      {/* Picture Section End*/}

      {/* Content Section */}
      <section className="h-full md:col-span-3 lg:col-span-3 xl:col-span-5 mxl:col-span-5 mmmxl:col-span-4 flex flex-col items-start gap-4">
        <TimeBox date={data?.date} endDate={data?.endDate} />
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
          ⚠️ THE PRIMARY BUTTON CHOOSES ITS DESTINATION FROM `participationEnabled`,
          AND THAT IS THE ONE DECISION THIS CARD MAKES ABOUT PARTICIPATION.

          Two shapes, and the reason they differ is a backwards-compatibility
          requirement rather than a design preference:

            participationEnabled → an INTERNAL `next/link` to `/event/[id]`, where
              the registration call to action lives and where the "in-app or
              external form" decision is made ONCE, by `resolveRegistrationTarget`.

            otherwise             → the admin's external `btnLink`, exactly as
              before this feature existed.

          A card that always linked to the detail page would be tidier, and it
          would also add a click to every event that still runs on a Google Form —
          the majority of them, since participation is off by default and has to be
          switched on per event. A card that always linked OUT would be the
          opposite failure: an event whose admin has switched it onto the in-app
          flow would keep advertising a stale external form on every list and on
          the homepage carousel, which is the exact contradiction the mode flag
          exists to prevent.

          `participationEnabled` is a MODE, not a gate. This card never renders
          "registration is open" from it — see the note on the field in
          `toPublicEvent`. The button says "View details & register" precisely
          because it cannot know whether the window is open.
        */}
        {data?.participationEnabled && data?.id ? (
          <Link href={`/event/${data.id}`} className="inline-flex">
            <button className="bg-black/30 text-white font-bold uppercase px-5 py-2 
          hover:text-gray-600 hover:bg-white border-[3px] border-white trans">
              View details &amp; register
            </button>
          </Link>
        ) : data?.btnLink ? (
          /*
            ⚠️ KNOWN DEFECT, DELIBERATELY NOT FIXED HERE — read before "fixing" it.

            `next/link` is the WRONG component for this href. The house rule for
            admin-supplied, outbound links is a PLAIN ANCHOR
            (`<a target="_blank" rel="noopener noreferrer">`, see the
            EXTERNAL LINK RULE block in `src/lib/hackathon.js:11-33`):
            `next/link` client-navigates, so an external target is pulled through
            our own router instead of handed to the browser, and a non-http scheme
            can break the router outright.

            Why it is still here: this predates the hackathon feature and is
            unrelated to it. Swapping the component changes client-navigation
            behaviour for EVERY existing event link on `/event` and the homepage
            carousel, which is a behaviour change that deserves its own review and
            its own verification — not a drive-by edit inside a security fix. It
            is also currently a *latent* bug rather than a live one, because the
            href now arrives already filtered: `toPublicEvent` runs it through
            `toSafeHref`, so by the time it reaches this line only http/https
            URLs can be present, and `rel="noopener noreferrer"` is already set.

            ⚠️ IT IS ALSO NOW THE MINORITY BRANCH. Since `participationEnabled`
            routes to the detail page instead, this anchor is reached only by
            events with no in-app participation configured — so fixing it later
            has a smaller blast radius than it had before, not a larger one.

            Logged as follow-up. Do not copy this pattern into new code.
          */
          <Link href={data?.btnLink} target="_blank" rel="noopener noreferrer">
            <button
              className="bg-black/30 text-white font-bold uppercase px-5 py-2 
          hover:text-gray-600 hover:bg-white border-[3px] border-white trans"
            >
              {data?.btnText}
            </button>
          </Link>
        ) : null}

        {/* Always reachable, whether or not the primary button goes anywhere
            useful. An event with no links at all still has a detail page, and a
            card that renders no way into it is a dead end. `next/link` is
            correct: this is an internal route. */}
        {data?.id ? (
          <Link
            href={`/event/${data.id}`}
            className="text-sm font-semibold text-white/85 underline underline-offset-4 hover:text-white"
          >
            View details
          </Link>
        ) : null}

        {data?.btnLink1 ? (
          <Link href={data?.btnLink1} target="_blank" rel="noopener noreferrer">
            <button
              className="bg-black/30 text-white font-bold uppercase px-5 py-2 
          hover:text-gray-600 hover:bg-white border-[3px] border-white trans"
            >
              {data?.btnText1}
            </button>
          </Link>
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

function TimeBox({ date, endDate }) {
  const getEventStatus = () => {
    const startTime = new Date(date).getTime();
    const endTime = new Date(endDate || date).getTime();
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
  }, [date, endDate]);

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
    <main className="flex gap-5">
      <section className="flex flex-col items-center font-bold gap-1">
        <div>Days</div>
        <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
          {days}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div>Hr</div>
        <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
          {hours}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div>Min</div>
        <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
          {minutes}
        </div>
      </section>

      <section className="flex flex-col items-center font-bold gap-1">
        <div>Sec</div>
        <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
          {seconds}
        </div>
      </section>

      <p className="self-end font-bold text-xl hidden lg:block">{phaseLabel}</p>
    </main>
  );
}
