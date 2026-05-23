"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaGlobe, FaLinkedin, FaArrowRight } from "react-icons/fa";
import donatorsData from "@/data/donators.json";

export default function DonatorsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const trackRef = useRef(null);
  const autoplayRef = useRef(null);
  const rafRef = useRef(null);
  const isHoveringRef = useRef(false);
  const touchStartX = useRef(0);
  const touchStartScroll = useRef(0);

  const scrollToIndex = (index) => {
    const track = trackRef.current;
    if (!track) return;

    const card = track.children[index];
    if (card) {
      const offset = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
    }
  };

  const updateCurrentIndex = () => {
    const track = trackRef.current;
    if (!track) return;

    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    const cards = Array.from(track.children);
    const nearest = cards.reduce(
      (best, card, idx) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - trackCenter);
        return distance < best.distance ? { index: idx, distance } : best;
      },
      { index: 0, distance: Infinity }
    );

    setCurrentIndex(nearest.index % donatorsData.length);
  };

  const handleScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      updateCurrentIndex();
      rafRef.current = null;
    });
  };

  const goTo = (index) => {
    const normalized = index % donatorsData.length;
    setCurrentIndex(normalized);
    scrollToIndex(normalized);
  };

  const handleTouchStart = (event) => {
    const track = trackRef.current;
    if (!track) return;
    touchStartX.current = event.touches[0].pageX;
    touchStartScroll.current = track.scrollLeft;
  };

  const handleTouchMove = (event) => {
    const track = trackRef.current;
    if (!track) return;
    const x = event.touches[0].pageX;
    const walk = x - touchStartX.current;
    track.scrollLeft = touchStartScroll.current - walk;
  };

  useEffect(() => {
    updateCurrentIndex();
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleWheelEvent = (event) => {
      if (!isHoveringRef.current) return;

      const delta = event.deltaY;
      const canScrollLeft = track.scrollLeft > 0;
      const canScrollRight = track.scrollLeft + track.clientWidth < track.scrollWidth - 1;

      if ((delta > 0 && canScrollRight) || (delta < 0 && canScrollLeft)) {
        event.preventDefault();
        event.stopPropagation();
        track.scrollBy({ left: delta, behavior: "auto" });
      }
    };

    track.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => track.removeEventListener("wheel", handleWheelEvent);
  }, []);

  useEffect(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
    }

    if (!isPaused) {
      autoplayRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % donatorsData.length;
          scrollToIndex(next);
          return next;
        });
      }, 3000);
    }

    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
      }
    };
  }, [isPaused]);

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-blue-50/40 to-white overflow-hidden">
      <div className="padding mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-header font-mono text-sm font-semibold mb-2 tracking-wide uppercase">
            // our supporters
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            Meet Our Generous Donators
          </h2>
          <p className="text-gray-500 mt-2 max-w-md">
            Organizations and individuals who support our mission and vision.
          </p>
        </div>
        <Link
          href="/donators"
          className="flex items-center gap-2 text-header font-semibold hover:gap-3 transition-all duration-300 group shrink-0"
        >
          <span>View All Donators</span>
          <FaArrowRight
            size={14}
            className="group-hover:translate-x-1 transition-transform duration-300"
          />
        </Link>
      </div>

      {/* Carousel Track */}
      <div className="relative">
        {/* Left fade gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-blue-50/40 to-transparent z-10 pointer-events-none" />
        {/* Right fade gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div
          ref={trackRef}
          onMouseEnter={() => {
            setIsPaused(true);
            setIsHovering(true);
            isHoveringRef.current = true;
          }}
          onMouseLeave={() => {
            setIsPaused(false);
            setIsHovering(false);
            isHoveringRef.current = false;
          }}
          onScroll={handleScroll}
          onTouchStart={(e) => {
            setIsPaused(true);
            handleTouchStart(e);
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => {
            setIsPaused(false);
          }}
          onTouchCancel={() => setIsPaused(false)}
          className="relative cursor-grab select-none flex gap-5 overflow-x-auto hide-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x pb-6 px-4 md:px-6"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {donatorsData.map((donator) => (
            <CarouselCard key={donator.id} donator={donator} />
          ))}
        </div>
      </div>

      {/* Dot Indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {donatorsData.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`transition-all duration-300 rounded-full ${currentIndex === index
              ? "w-6 h-2.5 bg-header"
              : "w-2.5 h-2.5 bg-gray-300 hover:bg-header/50"
              }`}
            aria-label={`Go to donator ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function CarouselCard({ donator }) {
  return (
    <div
      className="shrink-0 w-[calc(33.333%-14px)] min-w-[260px] bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 hover:border-header/30 transition-all duration-500 overflow-hidden group"
    >
      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-header to-blue-400" />

      <div className="p-5 flex flex-col items-center gap-3 text-center">
        {/* Avatar */}
        <div className="w-40 h-40 rounded-full overflow-hidden ring-4 ring-header/10 group-hover:ring-header/40 transition-all duration-500 mt-1">
          <img
            src={donator?.avatar}
            alt={donator?.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                donator?.name
              )}&background=3b60c9&color=fff&size=128`;
            }}
          />
        </div>

        {/* Name & Organization */}
        <div>
          <h3 className="font-bold text-gray-900 text-base capitalize group-hover:text-header transition-colors duration-300">
            {donator?.name}
          </h3>
          <span className="inline-block mt-1 bg-header/10 text-header text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {donator?.organization}
          </span>
        </div>

        {/* Contribution */}
        <div className="border-t border-gray-100 pt-2.5 w-full">
          <p className="text-xs text-gray-500 leading-relaxed">
            {donator?.contribution}
          </p>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-2">
          {donator?.website && (
            <a
              href={donator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-header hover:text-white text-gray-600 transition-all duration-300"
            >
              <FaGlobe size={13} />
            </a>
          )}
          {donator?.linkedin && (
            <a
              href={donator.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition-all duration-300"
            >
              <FaLinkedin size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
