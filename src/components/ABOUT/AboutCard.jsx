import { MdOutlineEmail } from "react-icons/md";
import Image from "next/image";
const DefaultAvater = "/assets/avatar/default-avatar.png";
import Link from "next/link";

export default function AboutCard({ Data }) {
  return (
    <main className="group bg-white flex flex-col items-center justify-between gap-8 px-3 pt-3 pb-7">
      <section className="h-[20rem]">
        <Image
          height={400}
          width={400}
          className="h-full w-full object-cover group-hover:scale-105 trans"
	          src={Data?.avatar || Data?.img || DefaultAvater}
	          alt={Data?.fullName || Data?.name || "Profile Picture"}
	        />
	      </section>
      <section className="flex flex-col items-center text-center justify-center gap-1 w-full min-w-0 px-2">
        <h1 className="text-xl sm:text-2xl font-semibold capitalize text-p-text break-words max-w-full">
          {Data?.fullName || Data?.name}
        </h1>
        <p className="italic capitalize text-base sm:text-xl text-muted-foreground break-words max-w-full">
          {Data?.displayPosition || Data?.roles?.role || Data?.position}
        </p>
        {Data?.batch && (
          <p className="text-sm font-medium text-primary">Batch {Data.batch}</p>
        )}

        {Data?.email ? (
          <Link
            href={`mailto:${Data.email}`}
            className="italic flex items-center justify-center gap-1 flex-wrap break-all text-xs sm:text-sm text-gray-600 hover:text-header transition-colors max-w-full mt-1"
          >
            <MdOutlineEmail size={18} className="shrink-0" />
            <span className="break-all">{Data.email}</span>
          </Link>
        ) : null}
      </section>

      <section>
        <Link
          href={`/profile/${Data?.uniID || Data?._id}`}
          className="mt-5 px-5 py-3 font-semibold border rounded-full bg-header hover:bg-gray-900 trans text-white"
        >
          View Profile
        </Link>
      </section>
    </main>
  );
}
