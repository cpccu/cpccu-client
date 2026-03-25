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
        // Use explicit string values to avoid [object Object] issue
        const namespace = String("cpccu-club");
        const key = String("total-visitors-v1");
        const url = `https://api.counterapi.dev/v1/${namespace}/${key}/up`;
        
        console.log("Fetching visitor count from:", url);
        
        // Validate URL before fetching
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
          console.error("Invalid URL generated");
          setTotalCount(1250);
          setLoading(false);
          return;
        }
        
        // Increment and get the cumulative count
        const response = await fetch(url);
        
        // Check if response is OK
        if (!response.ok) {
          console.error("Failed to fetch visitor count:", response.status, response.statusText);
          setTotalCount(1250);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        if (data && data.count) {
          setTotalCount(data.count);
        } else {
          setTotalCount(1250);
        }
      } catch (error) {
        console.error("Error fetching visitor count:", error);
        // Fallback to a reasonable number if API fails
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
          <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm">
            <FaUsers className="text-4xl md:text-5xl text-blue-400" />
          </div>
          
          <div className="flex flex-col items-start justify-center">
            <h3 className="text-4xl md:text-5xl font-custom font-thin text-white/90">
              {!loading ? (
                <CountUp
                  start={0}
                  end={totalCount}
                  duration={2.5}
                  useEasing={true}
                  formattingFn={(value) => {
                    if (value >= 1000) {
                      return Math.floor(value / 1000) + "K+";
                    }
                    return value;
                  }}
                />
              ) : (
                "..."
              )}
            </h3>
            <p className="text-xl md:text-2xl capitalize text-blue-300 font-medium tracking-wide">
              Total Visitors
            </p>
            <p className="text-sm md:text-base text-white/50 font-light mt-1 italic">
              Counting since March 24, 2026
            </p>
          </div>
        </div>
        
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