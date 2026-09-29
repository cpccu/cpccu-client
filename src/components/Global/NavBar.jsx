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
import { useGetPublicHackathonQuery } from "@/features/content/contentApi";
import { toPublicHackathon } from "@/lib/public-content";
import NavHackathonCountdown from "@/components/HACKATHON/NavHackathonCountdown";

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

  // WHY THERE IS NO `/content/hackathon/status` ENDPOINT
  // --------------------------------------------------
  // The nav only needs one bit: "is a hackathon live right now?". That is
  // exactly what the 200-vs-404 of `GET /content/hackathon` already answers,
  // and it is the FULL payload the `/hackathon` page needs anyway. This query
  // therefore piggy-backs on the SAME RTK Query cache entry
  // (`{ type: 'PublicContent', id: 'hackathon' }`) that the page reads, so
  // clicking through costs zero extra requests. A dedicated status endpoint
  // would be a second network round trip and a second cache entry to keep in
  // sync with the first.
  //
  // While loading, and on error, the entry is HIDDEN rather than shown: a nav
  // link that appears and then leads to "not available" reads as a bug, and the
  // alternative (showing it immediately) would flash it in on every page load.
  const {
    data: hackathonResponse,
    isLoading: hackathonLoading,
    isError: hackathonError,
  } = useGetPublicHackathonQuery();

  const hackathonLive =
    !hackathonLoading && !hackathonError && Boolean(hackathonResponse?.data);

  // The nav badge is the only nav consumer that READS a field off this payload,
  // so the house rule applies (doc.md §10.5): never render an API field
  // directly, always go through `toPublicHackathon`. The existence check above
  // deliberately stays a plain `Boolean(...)` — it reads no field, and keeping
  // it on the raw response means the "hide while loading" behaviour cannot be
  // changed by a mapper edit.
  const hackathon = hackathonLive ? toPublicHackathon(hackathonResponse.data) : null;

  // ⚠️ `requiresLiveHackathon` IS honoured; `requireLogin` IS DELIBERATELY NOT.
  //
  // `requireLogin` in `navBar.json` is currently DEAD CONFIG: it is declared on
  // the Job Pipeline entry and read by nothing. It is left unwired on purpose.
  // `/job-pipeline` is backed by the PUBLIC `GET /content/profiles` and
  // `JobPipeline.jsx` renders no login prompt, so honouring the flag would not
  // "lock" anything — it would simply remove a publicly reachable entry point
  // from the navigation of every signed-out visitor, which is a product change
  // nobody asked for on a page unrelated to the hackathon. Hiding a link is not
  // authorisation: the page and its data are public either way, and an admin
  // editing `navBar.json` would silently be changing who can find a page rather
  // than who can read it.
  //
  // If a nav entry ever does need to be genuinely member-only, the gate has to
  // go where the data is — on the endpoint and/or in the page — and the nav
  // flag can then mirror it. Do not wire this up on its own.
  const navItems = (Data || []).filter((item) => {
    if (item.requiresLiveHackathon && !hackathonLive) return false;
    return true;
  });

  useEffect(() => {
    if (paths.includes(pathname)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [pathname]);

  return (
    <ul className="flex flex-col lg:flex-row z-50 mt-2 lg:mt-0 w-full lg:w-auto">
      {navItems.length
        ? navItems.map((item, index) => {
            if (item.level === 0) {
              const isActive = pathname === item.path;

              // The live countdown is attached ONLY to the entry that is gated
              // on a hackathon existing, and only for a top-level (`level === 0`)
              // item. Keyed off `requiresLiveHackathon` rather than a hard-coded
              // path or label, so an admin renaming or re-pointing the entry in
              // `navBar.json` keeps the badge instead of silently losing it. The
              // `hackathon` null check is belt-and-braces: the filter above has
              // already removed the entry when no hackathon is live, and this
              // guarantees a badge is never rendered without dates behind it.
              //
              // ONE instance: the `<ul>` below is rendered once and reflowed
              // (`flex-col lg:flex-row`) into the mobile panel and the desktop
              // row, so the badge — and the single interval inside
              // `useHackathonPhase` — exists once per page, not once per layout.
              const countdownBadge =
                item.requiresLiveHackathon && hackathon ? (
                  <NavHackathonCountdown
                    phase={hackathon.phase}
                    startAt={hackathon.startAt}
                    endAt={hackathon.endAt}
                  />
                ) : null;

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
                    {/* The wrapper is added ONLY where a badge exists, so every
                        other nav item keeps its original bare-text markup and
                        the existing layout/classes are untouched. `whitespace-nowrap`
                        keeps the label on one line: the label is the link's
                        purpose, the badge is only an annotation, and a wrapped
                        label in a `py-7` nav row would reflow the whole row. */}
                    {countdownBadge ? (
                      <span className="inline-flex items-center whitespace-nowrap">
                        <span>{item.page}</span>
                        {countdownBadge}
                      </span>
                    ) : (
                      item.page
                    )}
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
