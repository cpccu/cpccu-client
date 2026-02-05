"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NavOpen from "@/assets/icons/navOpen.svg";
import NavClose from "@/assets/icons/navClose.svg";
import InstitudeInfo from "@/data/global/institude.json";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { faSignInAlt } from "@fortawesome/free-solid-svg-icons";
import Data from "@/data/global/navBar.json";
import GoToTop from "@/components/Global/GoToTop";

export default function NavBar() {
  const router = useRouter();
  const [fixed, setFixed] = useState(false);
  const [open, setOpen] = useState(false);
  const mobileNav = useRef(null);
  const mobileNavToggler = useRef(null);

  const navHandler = () => {
    setOpen((prev) => !prev);
  };

  const goHome = (e) => {
    e?.preventDefault?.();
    setOpen(false);
    router.push("/");
  };

  useEffect(() => {
    const scrollBar = () => {
      if (Math.ceil(window.scrollY) > 180) {
        setFixed(true);
      } else {
        setFixed(false);
      }
    };

    const mobileNavClose = (event) => {
      if (
        mobileNav.current &&
        mobileNavToggler.current &&
        !mobileNav.current.contains(event.target) &&
        !mobileNavToggler.current.contains(event.target) &&
        window.innerWidth < 976
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", scrollBar);
    window.addEventListener("click", mobileNavClose);

    return () => {
      window.removeEventListener("scroll", scrollBar);
      window.removeEventListener("click", mobileNavClose);
    };
  }, []);

  return (
    <main
      className={`${
        fixed && "md:sticky shadow-2xl"
      } sticky top-0 md:static transition-all duration-1000 z-50 bg-white flex items-center justify-between padding`}
    >
      <Link href="/" onClick={() => setOpen(false)}>
        <section
          onClick={goHome}
          className="flex items-center justify-center gap-2 py-2 lg:-py-0 cursor-default"
        >
          <img
            className="h-12"
            src={InstitudeInfo?.img}
            alt={InstitudeInfo?.alt}
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-lg md:text-2xl hidden md:block lg:hidden max-w-[1130px] mxl:block text-header font-bold font-custom">
              {InstitudeInfo?.fullName}
            </h1>
            <h1 className="text-lg md:text-2xl md:hidden lg:block mxl:hidden text-header font-bold font-custom">
              {InstitudeInfo?.shortName}
            </h1>
            <p className="text-sm font-bold">{InstitudeInfo?.uniName}</p>
          </div>
        </section>
      </Link>

      <section>
        <button
          ref={mobileNavToggler}
          onClick={navHandler}
          className="lg:hidden"
        >
          <img className="h-8 md:h-9" src={open ? NavClose : NavOpen} alt="" />
        </button>
        <nav
          ref={mobileNav}
          className={`${
            open ? "left-0" : "-left-[70%] md:-left-[40%]"
          } fixed top-0 bottom-0 w-[70%] md:w-[40%] shadow-2xl bg-white lg:shadow-none lg:w-full lg:bg-transparent lg:static trans z-50`}
        >
          <section className="flex py-2 items-center justify-between px-5 md:px-7 lg:py-4 border-b border-gray-600/30 lg:hidden">
            <section className="flex items-center gap-2">
              <img
                className="h-12"
                src={InstitudeInfo?.img}
                alt={InstitudeInfo?.alt}
              />
              <div>
                <h1 className="text-lg md:text-2xl hidden md:block lg:hidden max-w-[1130px] mxl:block text-header font-bold font-custom">
                  {InstitudeInfo?.fullName}
                </h1>
                <h1 className="text-lg md:text-2xl md:hidden lg:block mxl:hidden text-header font-bold font-custom">
                  {InstitudeInfo?.shortName}
                </h1>
                <p className="text-sm">{InstitudeInfo?.uniName}</p>
              </div>
            </section>
          </section>
          <NavItem setOpen={setOpen} />

          <Link href="/login">
            <button className="trans hover:ring bg-gradient-to-r from-header to-green-500 text-white flex md:hidden items-center justify-center gap-2 py-2 absolute bottom-20 left-10 right-10 rounded-full font-semibold">
              <FontAwesomeIcon icon={faSignInAlt} />
              <span>Login</span>
            </button>
          </Link>
        </nav>
      </section>
    </main>
  );
}

export function NavItem({ setOpen }) {
  const paths = ["/history", "/committee", "/member", "/alumni"];
  const [isOpen, setIsOpen] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    if (paths.includes(pathname)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [pathname]);

  return (
    <ul className="flex flex-col lg:flex-row z-50 mt-10 lg:mt-0">
      {Data
        ? Data.map((item, index) => {
            if (item.level === 0) {
              const isActive = pathname === item.path;
              return (
                <li key={index}>
                  <Link
                    href={item.path}
                    className={` ${
                      isActive
                        ? "bg-header text-white lg:border-b-4 lg:border-header lg:text-black lg:bg-header/20 lg:hover:bg-header/20"
                        : "hover:text-header trans hover:bg-header/20 lg:hover:bg-transparent"
                    } block px-5 md:px-7 py-2 lg:py-7 cursor-pointer font-semibold capitalize`}
                    onClick={() => setOpen(false)}
                  >
                    {item.page}
                  </Link>
                </li>
              );
            } else {
              return (
                <li key={index} className="group relative">
                  <button
                    className={` ${
                      isOpen
                        ? "bg-header text-white lg:border-b-4 lg:border-header lg:text-black lg:bg-header/20 lg:hover:bg-header/20"
                        : "group-hover:text-header trans hover:bg-header/20 lg:hover:bg-transparent"
                    } w-full flex items-center gap-3 px-5 md:px-7 py-2 lg:py-7 cursor-pointer font-semibold capitalize`}
                    onClick={() => setAboutOpen((prev) => !prev)}
                  >
                    <p>{item?.page}</p>
                    <FontAwesomeIcon
                      className={`${
                        aboutOpen ? "-rotate-180 lg:rotate-0" : "rotate-0"
                      }  trans`}
                      icon={faChevronDown}
                    />
                  </button>

                  <ul
                    className={`${
                      aboutOpen ? "group-hover:flex" : "hidden"
                    } lg:hidden lg:shadow-xl lg:group-hover:flex flex-col lg:items-center bg-white lg:absolute top-full left-0 ml-5 lg:ml-0 trans z-10`}
                  >
                    {item?.element.map((ele, num) => {
                      const isSubActive = pathname === ele?.path;
                      return (
                        <Link
                          href={ele?.path}
                          key={num}
                          className={`${
                            isSubActive ? "text-header" : "text-gray-900"
                          }  flex w-full hover:bg-header/20 cursor-pointer py-1 lg:py-2 capitalize font-semibold border-b`}
                          onClick={() => setOpen(false)}
                        >
                          <li className="w-full px-6">{ele?.page}</li>
                        </Link>
                      );
                    })}
                  </ul>
                </li>
              );
            }
          })
        : null}
    </ul>
  );
}
