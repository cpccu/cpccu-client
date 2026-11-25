"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogIn, Menu, UserPlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import InstituteInfo from "@/data/global/institude.json";
import Data from "@/data/global/navBar.json";
import { useGetPublicHackathonQuery } from "@/features/content/contentApi";
import { toPublicHackathon } from "@/lib/public-content";
import NavHackathonCountdown from "@/components/HACKATHON/NavHackathonCountdown";

const adminPanelRoles = ["admin", "moderator", "mentor"];

export default function NavBar() {
  const currentUser = useSelector((state) => state.auth.user);
  const canOpenAdminPanel = adminPanelRoles.includes(currentUser?.roles?.role);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1280) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [open]);

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="site-nav-inner padding">
        <Link href="/" onClick={() => setOpen(false)} className="site-brand">
          <img src={InstituteInfo?.img} alt={InstituteInfo?.alt || "CPCCU"} />
          <span className="site-brand-copy">
            <strong>CPCCU</strong>
            <small>City University</small>
          </span>
        </Link>

        <button
          type="button"
          className="site-menu-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="site-nav-panel"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div id="site-nav-panel" className={`site-nav-panel ${open ? "is-open" : ""}`}>
          <NavItem setOpen={setOpen} />
          <div className="site-nav-mobile-auth">
            {currentUser ? (
              <>
                {canOpenAdminPanel && <Link href="/admin" onClick={() => setOpen(false)}>Admin panel</Link>}
                <Link href={`/profile/${currentUser?.uniID || currentUser?._id}`} onClick={() => setOpen(false)}>My profile</Link>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}><LogIn size={17} /> Log in</Link>
                <Link className="site-nav-join" href="/signup" onClick={() => setOpen(false)}><UserPlus size={17} /> Join CPCCU</Link>
              </>
            )}
          </div>
        </div>
      </div>
      {open && (
        <button
          type="button"
          className="site-nav-overlay"
          aria-label="Close navigation menu"
          onClick={() => setOpen(false)}
        />
      )}
    </nav>
  );
}

export function NavItem({ setOpen }) {
  const pathname = usePathname();
  const [aboutOpen, setAboutOpen] = useState(false);
  const {
    data: hackathonResponse,
    isLoading: hackathonLoading,
    isError: hackathonError,
  } = useGetPublicHackathonQuery();
  const hackathonLive =
    !hackathonLoading && !hackathonError && Boolean(hackathonResponse?.data);
  const hackathon = hackathonLive ? toPublicHackathon(hackathonResponse.data) : null;
  const navItems = (Data || []).filter(
    (item) => !item.requiresLiveHackathon || hackathonLive,
  );

  useEffect(() => {
    setAboutOpen(["/history", "/committee", "/member", "/alumni"].includes(pathname));
  }, [pathname]);

  return (
    <ul className="site-nav-links">
      {navItems.map((item, index) => {
        if (item.level !== 0) {
          const isActive = item.element?.some((entry) => entry.path === pathname);
          return (
            <li className="site-nav-dropdown" key={item.page}>
              <button
                type="button"
                className={`site-nav-link ${isActive ? "is-active" : ""}`}
                onClick={() => setAboutOpen((value) => !value)}
                aria-expanded={aboutOpen}
                aria-haspopup="true"
              >
                {item.page} <ChevronDown size={14} className={aboutOpen ? "is-rotated" : ""} />
              </button>
              <ul className={`site-nav-submenu ${aboutOpen ? "is-open" : ""}`}>
                {item.element?.map((entry) => (
                  <li key={entry.path}>
                    <Link
                      href={entry.path}
                      className={pathname === entry.path ? "is-active" : ""}
                      onClick={() => setOpen(false)}
                    >
                      {entry.page}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        }

        const active = pathname === item.path;
        const badge = item.requiresLiveHackathon && hackathon ? (
          <NavHackathonCountdown
            phase={hackathon.phase}
            startAt={hackathon.startAt}
            endAt={hackathon.endAt}
          />
        ) : null;

        return (
          <li key={item.path || `${item.page}-${index}`}>
            <Link
              href={item.path}
              className={`site-nav-link ${active ? "is-active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span>{item.page}</span>{badge}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
