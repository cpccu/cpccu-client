"use client";

import React, { useState, useEffect } from 'react';
import { FaUsers } from 'react-icons/fa';
import CountUp from "react-countup";

const VisitorCounter = () => {
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        const url = "https://cpccu-server.onrender.com/api/visitor";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch");
        }

        const data = await response.json();

        setTotalCount(data?.count || 1250);

      } catch (error) {
        console.error("Visitor fetch error:", error);
        setTotalCount(1250);
      } finally {
        setLoading(false);
      }
    };

    fetchTotalCount();
  }, []);

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
              {!loading ? (
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
              )}
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