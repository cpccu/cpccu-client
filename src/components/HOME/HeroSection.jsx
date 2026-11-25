"use client";

import { useContext } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Code2, Terminal } from "lucide-react";
import Hero from "@/data/home/Hero.json";
import OurMissionScroll from "@/Context/OurMessionScroll/OurMessionScroll";
import { Link as ScrollMission } from "react-scroll";

export default function HeroSection() {
  const { target } = useContext(OurMissionScroll);

  return (
    <main
      className="home-hero"
      style={{ "--hero-image": `url(${Hero?.bgURL})` }}
    >
      <div className="home-hero-grid" aria-hidden="true" />
      <div className="home-hero-inner">
        <section className="home-hero-copy">
          <p className="home-eyebrow">
            <span className="home-live-dot" aria-hidden="true" />
            CITY UNIVERSITY <span>/</span> CSE COMMUNITY
          </p>
          <h1>
            Think deeper.
            <br />
            <span>Solve harder.</span>
          </h1>
          <p className="home-hero-description">
            {Hero?.secondheader} is where curious minds learn to turn tough
            problems into elegant solutions — together.
          </p>
          <div className="home-hero-actions">
            <ScrollMission
              to={target || "ourMission"}
              spy
              smooth
              offset={-24}
              duration={650}
            >
              <span className="home-button home-button-primary">
                Explore our mission <ArrowDown size={17} aria-hidden="true" />
              </span>
            </ScrollMission>
            <Link href="/history" className="home-button home-button-quiet">
              Our story <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="home-hero-note">
            <Code2 size={17} aria-hidden="true" />
            <span>Learn the craft. Find your people. Keep solving.</span>
          </div>
        </section>

        <aside className="home-code-card" aria-label="The CPCCU mindset">
          <div className="home-code-topbar">
            <div className="home-window-dots" aria-hidden="true">
              <i /> <i /> <i />
            </div>
            <span><Terminal size={14} aria-hidden="true" /> cpccu.cpp</span>
            <span className="home-code-language">C++</span>
          </div>
          <div className="home-code-body" aria-hidden="true">
            <p><span>01</span> <b className="code-purple">while</b> (!accepted) &#123;</p>
            <p><span>02</span> &nbsp;&nbsp;practice();</p>
            <p><span>03</span> &nbsp;&nbsp;learn_from_others();</p>
            <p><span>04</span> &nbsp;&nbsp;try_a_better_approach();</p>
            <p><span>05</span> &#125;</p>
            <p className="code-comment"><span>06</span> // progress, one problem at a time</p>
          </div>
          <div className="home-code-footer">
            <span className="home-terminal-mark"><span /> READY TO COMPILE</span>
            <span>City University</span>
          </div>
          <div className="home-code-stamp" aria-hidden="true">THINK<br />·<br />BUILD<br />·<br />COMPETE</div>
        </aside>
      </div>
      <div className="home-hero-bottom" aria-hidden="true">
        <span>COMPETITIVE PROGRAMMING CAMP</span>
        <span>BUILT TO LEARN. READY TO COMPETE.</span>
      </div>
    </main>
  );
}
