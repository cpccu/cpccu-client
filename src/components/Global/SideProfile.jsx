"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleDoubleLeft } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Data from "@/data/LogInfo.json";

export default function SideProfile() {
  const [isOpen, setOpen] = useState(false);
  const [show, setShow] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const path = `/profile/${Data?.uniID || Data?.username || Data?._id}`;

  const goProfile = useCallback(() => {
    router.push(path);
  }, [router, path]);

  useEffect(() => {
    setOpen(false);

    if (path === pathname) {
      setShow(false);
    } else if (!show) {
      setShow(true);
    }
  }, [pathname, path, show]);

  return show ? (
    <section className="fixed top-52 right-0 z-40 flex items-center justify-center group">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="bg-header-hover/20 group-hover:bg-header-hover trans flex items-center justify-center h-8 w-8"
      >
        <FontAwesomeIcon
          className={`text-white/60 group-hover:text-white text-2xl trans ${
            isOpen ? "rotate-180" : ""
          }`}
          icon={faAngleDoubleLeft}
        />
      </button>

      <main
        className={`${
          isOpen ? "flex" : "hidden"
        } h-20 bg-white items-center justify-center gap-3 px-5 shadow-custom`}
      >
        <img
          className="h-12 w-12 ring rounded-full"
          src="https://i.ibb.co/t3x1BtD/Screenshot-2024-05-15-025744.png"
          alt="profileIMG"
        />
        <h1
          onClick={goProfile}
          className="font-semibold text-lg cursor-pointer"
        >
          {Data?.name}
        </h1>
      </main>
    </section>
  ) : null;
}
