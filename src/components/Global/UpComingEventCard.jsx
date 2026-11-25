"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Laptop,
  Users,
  Trophy,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Code2,
  Timer,
} from "lucide-react";
import cn from "@/lib/cn.js";

const UpComingEventCard = ({ data, clName }) => {
  const imageUrl = typeof data?.img === "string" ? data.img.trim() : "";
  const hasRules = Boolean(
    data?.rules1 || data?.rules2 || data?.rules3 || data?.rules4
  );

  return (
    <div
      className={cn(
        "relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start cursor-default",
        clName
      )}
    >
      {/* 1. Picture Section */}
      <section className="lg:col-span-4 xl:col-span-3 w-full">
        <div className="relative group overflow-hidden rounded-xl md:rounded-2xl border border-white/10 bg-black/40 shadow-xl flex items-center justify-center aspect-[16/10] sm:aspect-[4/3] lg:aspect-auto lg:h-[22rem] w-full">
          {imageUrl ? (
            <img
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              src={imageUrl}
              alt={data?.alt || data?.eventHeadLine1 || "Event poster"}
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2.5 h-full w-full bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-slate-950/80 text-slate-400 p-6 text-center">
              <Code2 className="w-10 h-10 opacity-40 text-blue-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Competitive Programming Camp
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      </section>

      {/* 2. Main Content Section */}
      <section
        className={cn(
          "flex flex-col items-start gap-4 h-full justify-between",
          hasRules
            ? "lg:col-span-5 xl:col-span-5"
            : "lg:col-span-8 xl:col-span-9"
        )}
      >
        <div className="flex flex-col items-start gap-3 w-full">
          {/* Phase Badge & Countdown */}
          <TimeBox startAt={data?.startAt} endAt={data?.endAt} />

          {/* Event Title */}
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
            {data?.eventHeadLine1}
          </h2>

          {/* Event Description */}
          {data?.textContext && (
            <p className="text-slate-300/90 text-sm sm:text-base leading-relaxed line-clamp-3 font-normal">
              {data.textContext}
            </p>
          )}

          {/* Results & Rewards Box */}
          {data?.reward && (
            <div className="w-full rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:p-4 backdrop-blur-sm shadow-inner mt-1">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{data?.eventHeadLine2 || "Results & Rewards"}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
                {data.reward}
              </p>
            </div>
          )}
        </div>

        {/* Buttons Section (View details on top, action links below) */}
        <div className="flex flex-col gap-3 pt-2 w-full">
          {data?.id && (
            <Link
              href={`/event/${data.id}`}
              className="inline-flex self-start group"
            >
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm sm:text-base text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/30 hover:shadow-blue-600/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
              >
                <span>
                  {data?.participationEnabled
                    ? "View Details & Register"
                    : "View Details"}
                </span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          )}

          {(data?.btnLink || data?.btnLink1) && (
            <div className="flex flex-wrap items-center gap-2.5">
              {data?.btnLink && (
                <a
                  href={data.btnLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-200 bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-white/30 hover:text-white backdrop-blur-sm transition-all duration-200 cursor-pointer active:scale-95"
                  >
                    <span>{data?.btnText || "Learn More"}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </a>
              )}

              {data?.btnLink1 && (
                <a
                  href={data.btnLink1}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-200 bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-white/30 hover:text-white backdrop-blur-sm transition-all duration-200 cursor-pointer active:scale-95"
                  >
                    <span>{data?.btnText1 || "More Info"}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Contest Information Section */}
      {hasRules && (
        <section className="lg:col-span-3 xl:col-span-4 w-full">
          <div className="rounded-xl lg:rounded-2xl bg-white/[0.03] border border-white/10 p-4 sm:p-5 flex flex-col gap-3.5 backdrop-blur-sm shadow-inner">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-400 border-b border-white/10 pb-2.5">
              <Code2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{data?.eventHeadLine3 || "Contest Information"}</span>
            </div>
            <div className="flex flex-col gap-3 text-xs sm:text-sm text-slate-300">
              {data?.rules1 && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{data.rules1}</span>
                </div>
              )}
              {data?.rules2 && (
                <div className="flex items-start gap-2.5">
                  <Laptop className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{data.rules2}</span>
                </div>
              )}
              {data?.rules3 && (
                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{data.rules3}</span>
                </div>
              )}
              {data?.rules4 && (
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{data.rules4}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default UpComingEventCard;

function TimeBox({ startAt, endAt }) {
  const getEventStatus = () => {
    const startTime = new Date(startAt).getTime();
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
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
        <Clock className="w-3.5 h-3.5 animate-spin text-slate-400" />
        <span>Syncing status...</span>
      </div>
    );
  }

  if (status.phase === "ended") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/80 shadow-sm">
        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
        <span>Contest Ended</span>
      </div>
    );
  }

  const { timeLeft } = status;
  const { days, hours, minutes, seconds } = timeLeft;

  if (status.phase === "running") {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span>LIVE NOW</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
          <span className="text-slate-400">Ends in:</span>
          <span className="font-semibold text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
            {days > 0 ? `${days}d ` : ""}
            {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
          </span>
        </div>
      </div>
    );
  }

  // phase === "remaining"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-400 uppercase tracking-wider">
        <Timer className="w-3.5 h-3.5 text-blue-400" />
        <span>Contest Starts In</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex flex-col items-center bg-blue-950/70 border border-blue-500/30 rounded-lg px-2 sm:px-2.5 py-1 min-w-[42px] sm:min-w-[48px] shadow-sm">
          <span className="font-mono font-bold text-sm sm:text-base text-white leading-none">
            {days}
          </span>
          <span className="text-[9px] font-mono text-blue-300/80 uppercase tracking-widest mt-0.5">
            Days
          </span>
        </div>
        <span className="text-blue-400/60 font-bold">:</span>
        <div className="flex flex-col items-center bg-blue-950/70 border border-blue-500/30 rounded-lg px-2 sm:px-2.5 py-1 min-w-[42px] sm:min-w-[48px] shadow-sm">
          <span className="font-mono font-bold text-sm sm:text-base text-white leading-none">
            {String(hours).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-mono text-blue-300/80 uppercase tracking-widest mt-0.5">
            Hrs
          </span>
        </div>
        <span className="text-blue-400/60 font-bold">:</span>
        <div className="flex flex-col items-center bg-blue-950/70 border border-blue-500/30 rounded-lg px-2 sm:px-2.5 py-1 min-w-[42px] sm:min-w-[48px] shadow-sm">
          <span className="font-mono font-bold text-sm sm:text-base text-white leading-none">
            {String(minutes).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-mono text-blue-300/80 uppercase tracking-widest mt-0.5">
            Min
          </span>
        </div>
        <span className="text-blue-400/60 font-bold">:</span>
        <div className="flex flex-col items-center bg-blue-950/70 border border-blue-500/30 rounded-lg px-2 sm:px-2.5 py-1 min-w-[42px] sm:min-w-[48px] shadow-sm">
          <span className="font-mono font-bold text-sm sm:text-base text-white leading-none">
            {String(seconds).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-mono text-blue-300/80 uppercase tracking-widest mt-0.5">
            Sec
          </span>
        </div>
      </div>
    </div>
  );
}
