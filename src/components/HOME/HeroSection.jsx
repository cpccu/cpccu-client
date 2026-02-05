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
      <section className="flex flex-col items-center md:items-start italic">
        <h1 className="font-extrabold capitalize text-[2.3rem] md:text-[4rem]">
          {Hero?.header}
        </h1>
        <h3 className="text-[1.7rem] text-center md:text-[1.9rem] lg:text-left text-amber-300">
          {Hero?.secondheader}
        </h3>
      </section>
      <section className="conText text-center md:text-left">
        <p className="text-white/75">{Hero?.context1}</p>
        <p className="text-white/75">{Hero?.context2}</p>
        <p className="text-white/75">{Hero?.context3}</p>
        <p className="italic font-semibold text-white/80 mt-2">
          {Hero?.contextWriter}
        </p>
      </section>
      <div className="flex gap-5">
        <ScrollMission
          to={target || ""}
          spy={true}
          smooth={true}
          offset={-10}
          duration={900}
          animate={{ duration: 900, easing: "easeInOutCubic" }}
        >
          <button className="uppercase md:text-[1.2rem] lg:text-[1.3rem] font-semibold px-6 py-3 bg-header hover:bg-white hover:text-black trans">
            {Hero?.btn1Text}
          </button>
        </ScrollMission>

        <button
          onClick={goToAbout}
          className="uppercase md:text-[1.2rem] lg:text-[1.3rem] font-semibold px-6 py-3 bg-white text-black hover:bg-header hover:text-white trans"
        >
          {Hero?.btn2Text}
        </button>
      </div>
    </main>
  );
}
