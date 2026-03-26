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
      <main className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Data.map((item, index) => (
          <div key={index} className="w-full h-[16rem] relative group">
            <img
              className="w-full h-full object-cover opacity-0 transition-opacity duration-500  ease-in-out"
              src={item?.img}
              alt={`gIMG${index}`}
              style={{ transitionDelay: `${index * 50}ms` }} // Delay transition for each image
              onLoad={(e) => e.target.classList.add("opacity-100")} // Add opacity class when image is loaded
            />
            {/* hover detail and full start */}
            <div className="absolute bg-header/85 flex-col  justify-end items-center opacity-0 group-hover:justify-between  group-hover:py-14 group-hover:px-5 inset-0 flex group-hover:opacity-100 transition-all duration-700">
              <button
                onClick={() => FullSize(item?.img)}
                className="opacity-0 hidden group-hover:opacity-100 group-hover:flex items-center justify-center trans"
              >
                <img className="h-14" src={plusIcon} alt="plus" />
              </button>
              <div className="mt-8 text-white opacity-0 group-hover:opacity-100 group-hover:block trans">
                <h3 className="font-bold">{item?.header}</h3>
                <p className="font-semibold text-sm">{item?.date}</p>
              </div>
            </div>
            {/* hover details and full end */}
          </div>
        ))}
      </main>

      {Full?.open ? (
        <section className="fixed top-0 bottom-0 right-0 left-0 z-50 bg-black/65 flex flex-col items-center justify-center">
          <div className="relative">
            <img
              className="max-h-[calc(100svh-200px)] min-w-full md:min-w-[500px] lg:min-w-[710px]"
              src={Full?.img}
              alt="image"
            />
            <button onClick={ShortSize} className=" absolute -top-8 right-2">
              <FontAwesomeIcon
                className="text-3xl  text-slate-400"
                icon={faTimes}
              />
            </button>
          </div>
        </section>
      ) : null}
    </>
  ) : null;
}
