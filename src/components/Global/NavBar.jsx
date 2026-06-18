"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
const NavOpen = "/assets/icons/navOpen.svg";
const NavClose = "/assets/icons/navClose.svg";
import InstitudeInfo from "@/data/global/institude.json";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { faSignInAlt } from "@fortawesome/free-solid-svg-icons";
import Data from "@/data/global/navBar.json";
import { useSelector } from "react-redux";

const adminPanelRoles = ["admin", "moderator", "mentor"];

export default function NavBar() {
  const currentUser = useSelector((state) => state.auth.user);
  const canOpenAdminPanel = adminPanelRoles.includes(currentUser?.roles?.role);
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
      if (Math.ceil(window.scrollY) > 100) {
        setFixed(true);
      } else {
        setFixed(false);
      }
    };

    const mobileNavClose = (event) => {
      // Check if event.target is a valid Node
      if (!event?.target || !(event.target instanceof Node)) {
        return;
      }
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

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <main
      className={`${
        fixed ? "fixed top-0 left-0 right-0 shadow-xl" : "relative"
      } transition-all duration-300 z-[100] bg-white flex items-center justify-between padding min-h-[60px] md:min-h-[80px] w-full border-b border-gray-100`}
    >
      <Link href="/" onClick={() => setOpen(false)} className="z-[110]">
        <section
          onClick={goHome}
          className="flex items-center justify-center gap-2 py-2 cursor-pointer"
        >
          <img
            className="h-10 md:h-12 w-auto"
            src={InstitudeInfo?.img}
            alt={InstitudeInfo?.alt}
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-lg md:text-2xl hidden md:block lg:hidden max-w-[1130px] mxl:block text-header font-bold font-custom leading-tight">
              {InstitudeInfo?.fullName}
            </h1>
            <h1 className="text-lg md:text-2xl md:hidden lg:block mxl:hidden text-header font-bold font-custom leading-tight">
              {InstitudeInfo?.shortName}
            </h1>
            <p className="text-[10px] md:text-sm font-bold text-gray-500 uppercase tracking-tight">
              {InstitudeInfo?.uniName}
            </p>
          </div>
        </section>
      </Link>

      <section className="flex items-center">
        <button
          ref={mobileNavToggler}
          onClick={navHandler}
          className="lg:hidden z-[120] p-2 focus:outline-none flex items-center justify-center bg-gray-50 rounded-lg min-w-[40px] min-h-[40px]"
          aria-label="Toggle navigation"
        >
          <Image 
            src={open ? NavClose : NavOpen} 
            alt={open ? "Close" : "Open"} 
            width={24} 
            height={24}
            className="h-6 w-6 md:h-7 md:w-7"
          />
        </button>
        
        <nav
          ref={mobileNav}
          className={`${
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } fixed lg:static top-0 left-0 bottom-0 w-[80%] md:w-[50%] lg:w-full h-full lg:h-auto shadow-2xl lg:shadow-none bg-white lg:bg-transparent transition-transform duration-300 ease-in-out z-[110] overflow-y-auto lg:overflow-visible flex flex-col lg:flex-row`}
        >
          <section className="flex py-6 items-center justify-between px-6 md:px-8 border-b border-gray-100 lg:hidden bg-gray-50/50">
            <section className="flex items-center gap-3">
              <img
                className="h-10 w-auto"
                src={InstitudeInfo?.img}
                alt={InstitudeInfo?.alt}
              />
              <div>
                <h1 className="text-base font-bold text-header">
                  {InstitudeInfo?.shortName}
                </h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                  {InstitudeInfo?.uniName}
                </p>
              </div>
            </section>
          </section>

          <NavItem setOpen={setOpen} />

          <div className="mt-auto p-8 lg:hidden border-t border-gray-50">
            {canOpenAdminPanel && (
              <Link href="/admin" onClick={() => setOpen(false)}>
                <button className="mb-3 w-full bg-emerald-700 text-white flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all">
                  Admin Panel
                </button>
              </Link>
            )}
            {currentUser && (
              <Link href={`/profile/${currentUser?.uniID || currentUser?._id}`} onClick={() => setOpen(false)}>
                <button className="mb-3 w-full bg-blue-600 text-white flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all">
                  Profile
                </button>
              </Link>
            )}
            {!currentUser && (
              <Link href="/login" onClick={() => setOpen(false)}>
                <button className="w-full bg-header text-white flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
                  <FontAwesomeIcon icon={faSignInAlt} />
                  <span>Login to Portal</span>
                </button>
              </Link>
            )}
          </div>
        </nav>
      </section>

      {/* Mobile Overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/40 z-[105] lg:hidden backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />
      )}
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
    <ul className="flex flex-col lg:flex-row z-50 mt-2 lg:mt-0 w-full lg:w-auto">
      {Data
        ? Data.map((item, index) => {
            if (item.level === 0) {
              const isActive = pathname === item.path;
              return (
                <li key={index} className="w-full lg:w-auto">
                  <Link
                    href={item.path}
                    className={` ${
                      isActive
                        ? "text-header bg-blue-50/50 lg:border-b-4 lg:border-header lg:bg-transparent"
                        : "text-gray-700 hover:text-header hover:bg-gray-50 lg:hover:bg-transparent"
                    } block px-6 md:px-8 py-4 lg:py-7 cursor-pointer font-bold capitalize transition-all`}
                    onClick={() => setOpen(false)}
                  >
                    {item.page}
                  </Link>
                </li>
              );
            } else {
              return (
                <li key={index} className="group relative w-full lg:w-auto">
                  <button
                    className={` ${
                      isOpen
                        ? "text-header bg-blue-50/50 lg:border-b-4 lg:border-header lg:bg-transparent"
                        : "text-gray-700 group-hover:text-header hover:bg-gray-50 lg:hover:bg-transparent"
                    } w-full flex items-center justify-between lg:justify-start gap-3 px-6 md:px-8 py-4 lg:py-7 cursor-pointer font-bold capitalize transition-all`}
                    onClick={() => setAboutOpen((prev) => !prev)}
                  >
                    <span>{item?.page}</span>
                    <FontAwesomeIcon
                      className={`${
                        aboutOpen ? "rotate-180" : "rotate-0"
                      } transition-transform duration-300 lg:group-hover:rotate-180 text-xs`}
                      icon={faChevronDown}
                    />
                  </button>

                  <ul
                    className={`${
                      aboutOpen ? "flex" : "hidden"
                    } lg:hidden lg:group-hover:flex flex-col bg-gray-50/50 lg:bg-white lg:absolute lg:top-full lg:left-0 lg:min-w-[220px] lg:shadow-2xl z-10 lg:rounded-b-xl lg:border-t-2 lg:border-header`}
                  >
                    {item?.element.map((ele, num) => {
                      const isSubActive = pathname === ele?.path;
                      return (
                        <Link
                          href={ele?.path}
                          key={num}
                          className={`${
                            isSubActive ? "text-header bg-blue-50" : "text-gray-600"
                          } flex w-full hover:bg-header/10 cursor-pointer py-4 px-10 lg:px-6 capitalize font-semibold border-b border-gray-100 lg:border-none transition-colors`}
                          onClick={() => setOpen(false)}
                        >
                          <li className="w-full">{ele?.page}</li>
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
