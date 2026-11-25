"use client";

import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import { useSelector } from "react-redux";
import InstituteInfo from "@/data/global/institude.json";

const adminPanelRoles = ["admin", "moderator", "mentor"];

export default function Header() {
  const user = useSelector((state) => state.auth.user);
  const canOpenAdminPanel = adminPanelRoles.includes(user?.roles?.role);

  return (
    <header className="site-topbar">
      <div className="site-topbar-inner padding">
        <a className="site-contact-link" href={`mailto:${InstituteInfo?.email}`}>
          <Mail size={14} aria-hidden="true" />
          <span>{InstituteInfo?.email}</span>
          <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <div className="site-topbar-right">
          <span className="site-topbar-note">A student-led CSE community</span>
          {user ? (
            <>
              {canOpenAdminPanel && <Link href="/admin">Admin panel</Link>}
              <Link href={`/profile/${user?.uniID || user?._id}`}>My profile</Link>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link className="site-topbar-join" href="/signup">Join CPCCU <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
