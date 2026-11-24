"use client";

import { useContext } from "react";
import Hero from "@/data/home/Hero.json";
import OurMissionScroll from "@/Context/OurMessionScroll/OurMessionScroll";
import { Link as ScrollMission } from "react-scroll";
import { useRouter } from "next/navigation";

export default function HeroSection() {
  const { target } = useContext(OurMissionScroll);
  const router = useRouter();

  const heroContext = Hero?.context;

  const goToAbout = () => {
    router.push("/history");
  };

  return (
    <main
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url(${Hero?.bgURL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      className="padding text-white flex flex-col justify-center items-center md:items-start py-[3rem] gap-10 lg:gap-8 md:pb-[7rem] lg:pb-[16rem] cursor-default h-[calc(100svh-50px)] md:h-full"
    >
      <section className="flex flex-col items-center md:items-start italic max-w-full">
        <h1 className="font-extrabold capitalize text-3xl sm:text-4xl md:text-[4rem] text-center md:text-left leading-tight break-words">
          {Hero?.header}
        </h1>
        <h3 className="text-xl sm:text-2xl text-center md:text-[1.9rem] md:text-left text-amber-300 mt-2 break-words">
          {Hero?.secondheader}
        </h3>
      </section>
      <section className="conText text-center md:text-left max-w-3xl">
        <p className="text-white/75 text-sm sm:text-base">{Hero?.context1}</p>
        <p className="text-white/75 text-sm sm:text-base">{Hero?.context2}</p>
        <p className="text-white/75 text-sm sm:text-base">{Hero?.context3}</p>
        <p className="italic font-semibold text-white/80 mt-2 text-sm sm:text-base">
          {Hero?.contextWriter}
        </p>
      </section>
      <div className="flex flex-wrap gap-3 sm:gap-5 justify-center md:justify-start">
        <ScrollMission
          to={target || ""}
          spy={true}
          smooth={true}
          offset={-10}
          duration={900}
          animate={{ duration: 900, easing: "easeInOutCubic" }}
        >
          <button className="uppercase text-sm sm:text-base md:text-[1.2rem] lg:text-[1.3rem] font-semibold px-4 sm:px-6 py-2.5 sm:py-3 bg-header hover:bg-white hover:text-black trans shadow-md">
            {Hero?.btn1Text}
          </button>
        </ScrollMission>

        <button
          onClick={goToAbout}
          className="uppercase text-sm sm:text-base md:text-[1.2rem] lg:text-[1.3rem] font-semibold px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-black hover:bg-header hover:text-white trans shadow-md"
        >
          {Hero?.btn2Text}
        </button>
      </div>
    </main>
  );
}
