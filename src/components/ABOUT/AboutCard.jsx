import { MdOutlineEmail } from "react-icons/md";
import Link from "next/link";

export default function AboutCard({ Data }) {
  return (
    <main className="group bg-white flex flex-col items-center justify-between gap-8 px-3 pt-3 pb-7">
      <section className="h-[20rem]">
        <img
          className="h-full w-full object-cover group-hover:scale-105 trans"
          src={Data?.img}
          alt={Data?.name}
        />
      </section>
      <section className="flex flex-col items-center text-center justify-center gap-1">
        <h1 className="text-2xl font-semibold capitalize text-p-text">
          {Data?.name}
        </h1>
        <p className={`italic capitalize text-xl ${Data?.type && "font-bold"}`}>
          {Data?.position}
        </p>

        <Link
          href={`mailto:${Data?.email}`}
          className="italic flex items-center justify-center gap-1 flex-wrap"
        >
          <MdOutlineEmail size={20} />
          <span>{Data?.email}</span>
        </Link>
      </section>

      <section>
        <Link
          href={`/profile/${Data?.name.replace(/\s/g, "").toLowerCase()}`}
          className="mt-5 px-5 py-3 font-semibold border rounded-full bg-header hover:bg-gray-900 trans text-white"
        >
          View Profile
        </Link>
      </section>
    </main>
  );
}
