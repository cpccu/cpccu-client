import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import cn from "../../../lib/cn.js";

const UpComingEventCard = ({ data, clName }) => {
  return (
    <main
      className={cn(
        "relative grid md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 mxl:grid-cols-8 mmmxl:grid-cols-10 gap-7 lg:gap-5 mmmxl:gap-10 cursor-default overflow-hidden",
        clName
      )}
    >
      {/* Picture Section */}
      <section className="md:col-span-3 lg:col-span-4 xl:col-span-3 mxl:col-span-3 mmmxl:col-span-3 md:h-[20rem] lg:h-[28rem]  mxl:h-auto mmmxl:h-[26rem] xl:h-auto overflow-hidden">
        <img
          className="h-full w-full object-cover"
          src={data?.img}
          alt={data?.alt}
        />

        <div className="h-[4%] bg-black/50"></div>
      </section>
      {/* Picture Section End*/}

      {/* Content Section */}
      <section className="h-full md:col-span-3 lg:col-span-3 xl:col-span-5 mxl:col-span-5 mmmxl:col-span-4 flex flex-col items-start gap-4">
        <TimeBox date={data?.date} />
        <h1 className="text-2xl lg:text-3xl xl:text-4xl  font-semibold lg:line-clamp-none">{`"`}
          {data?.eventHeadLine1}{`"`}
        </h1>
        <p className="font-[450] text-xl lg:line-clamp-3">{data?.textContext}</p>

        {/* reward */}
        <h1 className="text-3xl hidden lg:block font-semibold lg:line-clamp-1">
          {data?.eventHeadLine2}
        </h1>
        <p className="font-[450] text-2xl hidden lg:block lg:line-clamp-3">{data?.reward}</p>

        <h1 className="text-2xl hidden lg:hidden mmmxl:hidden font-semibold lg:line-clamp-1">
          {data?.eventHeadLine3}
        </h1>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" -> "}
          {data?.rules1}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" -> "}
          {data?.rules2}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" -> "}
          {data?.rules3}
        </p>
        <p className="font-[450] hidden lg:hidden mmmxl:hidden  lg:line-clamp-3">
          {" -> "}
          {data?.rules4}
        </p>

        {data?.btnLink ? (
          <Link to={data?.btnLink} target="_blank" rel="noopener noreferrer">
            <button
              className="bg-black/30 text-white font-bold uppercase px-5 py-2 
          hover:text-gray-600 hover:bg-white border-[3px] border-white trans"
            >
              {data?.btnText}
            </button>
          </Link>
        ) : null}

        {data?.btnLink1 ? (
          <Link to={data?.btnLink1} target="_blank" rel="noopener noreferrer">
            <button
              className="bg-black/30 text-white font-bold uppercase px-5 py-2 
          hover:text-gray-600 hover:bg-white border-[3px] border-white trans"
            >
              {data?.btnText1}
            </button>
          </Link>
        ) : null}


      </section>

      {/* 3rd column - only for mmmxl - 1750px and up */}
      <section className="hidden mmmxl:flex relative py-3  h-full md:col-span-3 lg:col-span-3 xl:col-span-5 mxl:col-span-5 mmmxl:col-span-3 flex-col items-start gap-4">
        <h1 className="text-2xl hidden lg:hidden mmmxl:block py-4 font-semibold lg:line-clamp-1">
          {data?.eventHeadLine3}
        </h1>
        <p className="font-[450] text-xl hidden lg:hidden  mmmxl:block py-3lg:line-clamp-3">
          {" ⛔ "}
          {data?.rules1}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden  mmmxl:block py-3 lg:line-clamp-3">
          {" ❌ "}
          {data?.rules2}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden mmmxl:block py-3 lg:line-clamp-3">
          {" 🚫 "}
          {data?.rules3}
        </p>
        <p className="font-[450] text-xl hidden lg:hidden mmmxl:block py-3 lg:line-clamp-3">
          {" ✅ "}
          {data?.rules4}
        </p>
      </section>


      {/* Content Section End */}
    </main>
  );
};

export default UpComingEventCard;

function TimeBox({ date }) {
  const calculateTimeLeft = () => {
    const difference = +new Date(date) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <main className="flex gap-5">
      {(!days && !hours && !minutes && !seconds) ? <section className="flex flex-col items-center font-bold gap-1">
        <div className="border text-center px-5 py-2 font-bold text-2xl rounded-xl bg-black/70 trans">
          Ended.
        </div>
      </section> : (
        <>
          <section className="flex flex-col items-center font-bold gap-1">
            <div>Days</div>
            <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70 trans">
              {days || "00"}
            </div>
          </section><section className="flex flex-col items-center font-bold gap-1">
            <div>Hr</div>
            <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
              {hours || "00"}
            </div>
          </section><section className="flex flex-col items-center font-bold gap-1">
            <div>Min</div>
            <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
              {minutes || "00"}
            </div>
          </section><section className="flex flex-col items-center font-bold gap-1">
            <div>Sec</div>
            <div className="border text-center px-3 py-1 font-bold text-xl bg-black/70">
              {seconds || "00"}
            </div>
          </section>
        </>
      )}


      {(!days && !hours && !minutes && !seconds) ? null : <p className="self-end font-bold text-xl hidden lg:block">Remaining</p>}
    </main>
  );
}
