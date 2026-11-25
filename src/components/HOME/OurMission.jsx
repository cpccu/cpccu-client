"use client";

import { useContext, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Braces } from "lucide-react";
import OurMissionScroll from "@/Context/OurMessionScroll/OurMessionScroll";
import Data from "@/data/home/OurMission.json";

export default function OurMission() {
  const { setTarget } = useContext(OurMissionScroll);

  useEffect(() => {
    setTarget("ourMission");
  }, [setTarget]);

  return (
    <section id="ourMission" className="home-mission">
      <div className="home-mission-inner padding">
        <div className="home-mission-image">
          <img src={Data?.img} alt={Data?.alt || "CPCCU students learning together"} loading="lazy" />
          <span className="home-image-tag"><Braces size={16} aria-hidden="true" /> LEARN BY SOLVING</span>
        </div>
        <div className="home-mission-copy">
          <p className="home-section-kicker">01 / THE REASON WE GATHER</p>
          <h2>Good ideas get <span>better together.</span></h2>
          <p>{Data?.context1}</p>
          <p>{Data?.context2}</p>
          <Link href="/history" className="home-text-link">
            Get to know us <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
