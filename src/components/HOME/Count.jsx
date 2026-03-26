"use client";

import Image from "next/image"; 
const useIMG = "/assets/icons/user.svg";
const pictureIMG = "/assets/icons/picture.svg";
const eventIMG = "/assets/icons/event.svg";
const medalIMG = "/assets/icons/medal.svg";
import Data from "@/data/home/Count.json";
import CountUp from "react-countup";
import { useState, useRef, useEffect } from "react";

function ScrollTrigger({ onEnter, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onEnter?.();
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [onEnter]);

  return <div ref={ref}>{children}</div>;
}

export default function Count() {
  const [startCount, setStartCount] = useState(false);

  const AllIMG = [useIMG, pictureIMG, eventIMG, medalIMG];

  return (
    <ScrollTrigger onEnter={() => setStartCount(true)}>
      <main className="bg-count text-white grid items-center md:justify-between md:grid-cols-2 lg:grid-cols-4 md:gap-x-5 gap-y-14 lg:gap-5 py-12 md:py-14 lg:py-20 padding">
        
        {Data?.map((item, index) => (
          <section
            key={index}
            className="flex items-center justify-center gap-x-12 md:gap-5"
          >
            
            <Image
              src={AllIMG[index]}
              alt={item.title}
              width={56}
              height={56}
              className="h-12 md:h-14 w-auto"
            />

            <div className="flex flex-col items-start justify-center">
              <h3 className="text-3xl md:text-4xl font-custom font-thin text-white/90">
                {startCount && (
                  <CountUp
                    end={item?.count}
                    duration={1.5}
                    formattingFn={(value) =>
                      value >= 1000
                        ? Math.floor(value / 1000) + "K+"
                        : value
                    }
                  />
                )}
              </h3>

              <p className="text-xl capitalize">{item?.title}</p>
            </div>
          </section>
        ))}

      </main>
    </ScrollTrigger>
  );
}