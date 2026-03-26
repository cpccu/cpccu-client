"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
const IMG404 = "/assets/img/404.jpg";

export default function NotFound() {
  const router = useRouter();

  const GoToHome = () => {
    router.push("/");
  };

  return (
    <section className="flex items-center justify-center">
      <main className="flex flex-col items-center justify-center h-screen py-32">
        <Image className="max-h-full w-auto" src={IMG404} alt="404" width={800} height={600} />
        <button
          onClick={GoToHome}
          className="border px-3 py-2 mt-4 font-semibold bg-header-hover hover:bg-header trans text-white"
        >
          Go Home
        </button>
      </main>
    </section>
  );
}
