"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleUp } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import { animateScroll as scroll } from "react-scroll";

export default function GoToTop() {
  const [visible, setVisible] = useState(false);

  const goTop = () => {
    scroll.scrollToTop({
      duration: 1500,
      smooth: "easeInOutQuart",
    });
  };

  useEffect(() => {
    const scrolltoTop = () => {
      if (Math.ceil(window.scrollY) > 410) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", scrolltoTop);
  }, []);
  return (
    <button
      onClick={goTop}
      aria-label="Scroll to top"
      className={`${
        visible ? "fixed" : "hidden"
      } z-40 bottom-6 right-2 lg:right-3 bg-scroll hover:bg-header-hover h-11 w-11 rounded-full flex items-center justify-center trans`}
    >
      <FontAwesomeIcon className="text-xl text-white" icon={faAngleUp} />
    </button>
  );
}
