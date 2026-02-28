import Link from "next/link";
import InstitudeInfo from "@/data/global/institude.json";
import { IoMailOpenOutline } from "react-icons/io5";
import { MdOutlineCall } from "react-icons/md";
import { useFetchUsersQuery } from "@/features/users/userApi";

export default function Header() {
  const { data: user, isLoading, isError } = useFetchUsersQuery();
  return (
    <header
      className={` bg-blue-950 hidden md:flex text-white justify-between items-center padding`}
    >
      <div className="flex gap-7 font-semibold text-sm">
        <p>
          <Link
            className="flex items-center justify-center gap-2"
            href={`mailto:${InstitudeInfo?.email}`}
          >
            <IoMailOpenOutline size={25} />
            <span>{InstitudeInfo?.email}</span>
          </Link>
        </p>
        <p>
          <Link
            className="flex items-center justify-center gap-2"
            href={`tel:${InstitudeInfo?.phone}`}
          >
            <MdOutlineCall size={25} /> <span>{InstitudeInfo?.phone}</span>
          </Link>
        </p>
      </div>
      <div className="flex gap-3 items-center font-semibold text-sm">
       {user?.data ? (
          <Link
            href={`/profile/${user.data._id}`}
            className="flex items-center justify-center gap-2"
          >
            <button className="bg-header text-white px-4 py-2 rounded-full">
              Profile
            </button>
          </Link>
        ) : (
          <>
           <Link href="/login">
          <button className="py-2 px-5 bg-header/90 hover:bg-header trans">
            Login
          </button>
        </Link>

        <Link href="/signup">
          <button className="py-2 px-5 bg-green-600 hover:bg-green-500 trans">
            Signup
          </button>
        </Link>
          </>
        )
        }
      </div>
    </header>
  );
}
