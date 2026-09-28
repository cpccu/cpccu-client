"use client";

import React, { useState, useEffect } from "react";
import { FaUsers } from "react-icons/fa";
import CountUp from "react-countup";

const VISITOR_KEY = "cpccu_last_visit";
const ONE_HOUR = 60 * 60 * 1000;
// Visitor counts are the site's production analytics: the backend counter is
// shared by every visitor, so a local `npm run dev` would permanently inflate
// it and show the site owner a wrong number. Development therefore makes NO
// visitor calls at all — neither the GET total nor the POST increment.
//
// `process.env.NODE_ENV` is replaced with a literal by the Next.js/SWC compiler
// at build time, exactly like any other env reference — this is a build-time
// constant, NOT a runtime check. Both branches still ship in the bundle; the
// guard exists for behaviour, not for dead-code elimination.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// This component calls the visitor endpoint with raw `fetch` instead of going
// through RTK Query, so it does NOT inherit the `baseApi.js` fallback — it has to
// resolve its own base URL, and the two must agree.
//
// The default here MUST be the absolute cross-origin backend origin
// (`http://localhost:5000`), never `""`. An empty default silently degrades to
// the SAME-ORIGIN relative path `/api/visitor`, which resolves against the Next
// dev server on :3000. There is no `src/app/api` in this repo (the App Router
// API migration was reverted and the Express backend is mounted separately), so
// :3000 answers both calls with 404 and the console fills with "Failed to fetch"
// / "Failed to increment".
//
// No `/v1` suffix is appended on purpose: the backend mounts the visitor router
// at `/api`, so the reachable paths are `http://localhost:5000/visitor` and
// `http://localhost:5000/api/v1/visitor` (the router aliases `/v1/*`).
// `http://localhost:5000/visitor` is the shorter of the two working URLs.
//
// `NEXT_PUBLIC_API_BASE_URL` is deliberately UNSET and must stay that way. See
// `.env` lines 29-55: `NEXT_PUBLIC_*` values are inlined at build time, so a
// set-but-wrong value silently wins in production and this `||` fallback never
// gets a chance to apply. The fallback — not the environment — is the thing to
// fix here, which is why this default is load-bearing rather than incidental.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const VISITOR_API_URL = API_BASE_URL
  ? `${API_BASE_URL.replace(/\/+$/, "")}/visitor`
  : "/api/visitor";

const getStoredVisitTimestamp = () => {
  try {
    return localStorage.getItem(VISITOR_KEY);
  } catch (error) {
    return null;
  }
};

const setStoredVisitTimestamp = (timestamp) => {
  try {
    localStorage.setItem(VISITOR_KEY, timestamp.toString());
  } catch (error) {
    console.error("Visitor timestamp save error:", error);
  }
};

const shouldIncrementVisitor = () => {
  const lastVisit = getStoredVisitTimestamp();

  if (!lastVisit) {
    return true;
  }

  const lastVisitTime = Number(lastVisit);

  return Number.isNaN(lastVisitTime) || Date.now() - lastVisitTime > ONE_HOUR;
};

const VisitorCounter = () => {
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Business rule: visitor counts are only ever recorded in production.
    // Bailing out here — before ANY of the effect's work — is what also skips
    // the `localStorage` timestamp write below. That write only exists to
    // throttle the hourly increment, and a development timestamp would pollute
    // the developer's own browser state to serve a request we are not making.
    if (!IS_PRODUCTION) {
      return undefined;
    }

    let isMounted = true;

    const fetchTotalCount = async () => {
      try {
        const response = await fetch(VISITOR_API_URL);

        if (!response.ok) {
          throw new Error("Failed to fetch");
        }

        const data = await response.json();

        if (isMounted) {
          setTotalCount(data?.count ?? 1250);
        }
      } catch (error) {
        console.error("Visitor fetch error:", error);
        if (isMounted) {
          setTotalCount(1250);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const incrementVisitor = async () => {
      if (!shouldIncrementVisitor()) {
        return false;
      }

      try {
        const response = await fetch(`${VISITOR_API_URL}/increment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to increment");
        }

        return true;
      } catch (error) {
        console.error("Visitor increment error:", error);
        return false;
      }
    };

    const initializeVisitorCounter = async () => {
      if (shouldIncrementVisitor()) {
        const incremented = await incrementVisitor();

        if (incremented) {
          setStoredVisitTimestamp(Date.now());
        }
      }

      await fetchTotalCount();
    };

    initializeVisitorCounter();

    return () => {
      isMounted = false;
    };
  }, []);

  // In development the count is never fetched, so the section still renders (same
  // shell, same height, no layout shift) but the number is replaced by a fixed
  // non-numeric placeholder.
  //
  // The placeholder deliberately depends on NOTHING that is fetched or on React
  // state. This is a hydration concern, not a styling one: the server has no
  // `totalCount` and no `loading === false`, so rendering a number here would
  // make the first client paint differ from the server HTML. `IS_PRODUCTION` is
  // a compile-time constant that is inlined identically into the server render
  // and the client bundle, so this branch picks the same side of the `?:` on
  // both. Switching to production is therefore a pure data change.
  const countDisplay = IS_PRODUCTION ? (
    !loading ? (
      <CountUp
        start={0}
        end={totalCount}
        duration={2.5}
        useEasing={true}
        // formattingFn={(value) => {
        //   if (value >= 1000) {
        //     return Math.floor(value / 1000) + "K+";
        //   }
        //   return value;
        // }}
      />
    ) : (
      "..."
    )
  ) : (
    "—"
  );

  return (
    <section className="bg-count text-white py-12 md:py-16 lg:py-14 padding border-t border-white/10">
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-x-8 md:gap-10">
          {/* ICON */}
          <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm">
            <FaUsers className="text-4xl md:text-5xl text-blue-400" />
          </div>

          {/* TEXT SECTION */}
          <div className="flex flex-col items-start justify-center">
            {/* COUNT */}
            <h3 className="text-4xl md:text-5xl font-custom font-thin text-white/90">
              {countDisplay}
            </h3>

            {/* TITLE */}
            <p className="text-xl md:text-2xl capitalize text-blue-300 font-medium tracking-wide">
              Total Visitors
            </p>

            {/* SUBTITLE */}
            <p className="text-sm md:text-base text-white/50 font-light mt-1 italic">
              Counting since April 2026
            </p>
          </div>
        </div>

        {/* LIVE BADGE */}
        <div className="mt-8 flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 rounded-full border border-blue-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <p className="text-xs font-medium text-blue-200 uppercase tracking-widest">
            Live Community Engagement
          </p>
        </div>
      </div>
    </section>
  );
};

export default VisitorCounter;
