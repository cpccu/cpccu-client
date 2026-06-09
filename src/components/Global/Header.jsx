"use client";

import Link from "next/image";
import LinkNext from "next/link";
import { useSelector } from "react-redux";
import { IoMailOpenOutline } from "react-icons/io5";
import InstitudeInfo from "@/data/global/institude.json";

export default function Header() {
  // 1. Get the logged-in user from Redux
  const user = useSelector((state) => state.auth.user);

  return (
    <header className="bg-blue-950 hidden md:flex text-white justify-between items-center px-12 py-2">
      {/* Left side: Contact Info */}
      <div className="flex gap-7 font-semibold text-sm">
        <LinkNext
          className="flex items-center justify-center gap-2"
          href={`mailto:${InstitudeInfo?.email}`}
        >
          <IoMailOpenOutline size={25} />
          <span>{InstitudeInfo?.email}</span>
        </LinkNext>
      </div>

      {/* Right side: Auth Buttons (Same Design as Previous) */}
      <div className="flex gap-3 items-center font-semibold text-sm">
        {user ? (
          <>
            {user?.roles?.role === "admin" && (
              <LinkNext href="/admin">
                <button className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold hover:bg-emerald-700 transition-all">
                  Admin
                </button>
              </LinkNext>
            )}
            <LinkNext href={`/profile/${user._id}`}>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition-all">
                Profile
              </button>
            </LinkNext>
          </>
        ) : (
          /* Show Login and Signup buttons if logged out */
          <>
            <LinkNext href="/login">
              <button className="py-2 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg transition-all font-bold">
                Login
              </button>
            </LinkNext>

            <LinkNext href="/signup">
              <button className="py-2 px-6 bg-green-600 hover:bg-green-500 rounded-lg transition-all font-bold">
                Signup
              </button>
            </LinkNext>
          </>
        )}
      </div>
    </header>
  );
}
