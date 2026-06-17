"use client";

import { useState } from "react";
const plusIcon = "/assets/icons/plus.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

export default function GalleryCard({ Data }) {
  const [Full, setFull] = useState({ img: "", open: false });

  const DisableScroll = () => {
    document.body.classList.toggle("overflow-hidden");
  };

  const FullSize = (img) => {
    DisableScroll();
    setFull({ img: img, open: true });
  };

  const ShortSize = () => {
    DisableScroll();
    setFull({ img: "", open: false });
  };

  return Data ? (
    <>
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Data.map((item, index) => (
          <div
            key={index}
            className="w-full h-64 relative group cursor-pointer overflow-hidden rounded-lg shadow-custom hover:shadow-lg trans"
          >
            <img
              className="w-full h-full object-cover opacity-0 transition-opacity duration-500 ease-in-out"
              src={item?.img}
              alt={`gIMG${index}`}
              style={{ transitionDelay: `${index * 50}ms` }}
              onLoad={(e) => e.target.classList.add("opacity-100")}
            />
            <div className="absolute bg-header/90 flex-col justify-end items-center opacity-0 group-hover:justify-between group-hover:py-14 group-hover:px-5 inset-0 flex group-hover:opacity-100 transition-all duration-700">
              <button
                onClick={() => FullSize(item?.img)}
                className="opacity-0 hidden group-hover:opacity-100 group-hover:flex items-center justify-center trans"
              >
                <img className="h-14 filter brightness-0 invert" src={plusIcon} alt="plus" />
              </button>
              <div className="mt-8 text-white opacity-0 group-hover:opacity-100 group-hover:block trans">
                <h3 className="font-bold text-lg">{item?.header}</h3>
                <p className="font-medium text-sm">{item?.date}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {Full?.open ? (
        <section 
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 pt-16"
          onClick={ShortSize}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={ShortSize}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 trans bg-black/50 rounded-full p-2"
              aria-label="Close image"
            >
              <FontAwesomeIcon className="text-2xl" icon={faTimes} />
            </button>
            <img
              className="max-h-[calc(100svh-140px)] w-auto h-auto object-contain"
              src={Full?.img}
              alt="image"
            />
          </div>
        </section>
      ) : null}
    </>
  ) : null;
}