"use client";

import useIMG from "@/assets/icons/user.svg";
import pictureIMG from "@/assets/icons/picture.svg";
import eventIMG from "@/assets/icons/event.svg";
import medalIMG from "@/assets/icons/medal.svg";
import Data from "@/data/home/Count.json";
import CountUp from "react-countup";
import { useState, useRef, useEffect } from "react";

function ScrollTrigger({ onEnter, onExit, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onEnter?.();
          } else {
            onExit?.();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onEnter, onExit]);

  return <div ref={ref}>{children}</div>;
}

export default function Count() {
  const AllIMG = [useIMG, pictureIMG, eventIMG, medalIMG];
  const [countState, setCountState] = useState(false);
  return (
    <ScrollTrigger
      onEnter={() => {
        setCountState(true);
      }}
      onExit={() => {
        setCountState(false);
      }}
    >
      <main className="bg-count text-white grid items-center md:justify-between  md:grid-cols-2 lg:grid-cols-4 md:gap-x-5 gap-y-14 md:gap-y-14 lg:gap-5 py-12 md:py-14 lg:py-20 padding">
        {/* counter section start */}
        {Data
          ? Data.map((item, index) => (
              <section
                key={index}
                className="flex items-center justify-center gap-x-12 md:gap-5"
              >
                <img
                  className="h-12 md:h-14"
                  src={AllIMG[index]}
                  alt={`image${index + 1}`}
                />
                <div className="flex flex-col items-start justify-center">
                  <h3 className="text-3xl md:text-4xl font-custom font-thin text-white/90">
                    {countState ? (
                      <CountUp
                        start={0}
                        end={item?.count}
                        duration={1.5}
                        formattingFn={(value) => {
                          if (value >= 1000) {
                            return Math.floor(value / 1000) + "K+";
                          }
                          return value;
                        }}
                      />
                    ) : null}
                  </h3>
                  <p className="text-xl capitalize">{item?.title}</p>
                </div>
              </section>
            ))
          : null}
        {/* counter section end */}
      </main>
    </ScrollTrigger>
  );
}
