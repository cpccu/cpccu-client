import { Link } from "react-router-dom";
import InstitudeInfo from "../../../data/global/institude.json";
import { IoMailOpenOutline } from "react-icons/io5";
import { MdOutlineCall } from "react-icons/md";

export default function Header() {
  return (
    <header
      className={` bg-blue-950 hidden md:flex text-white justify-between items-center padding`}
    >
      <div className="flex gap-7 font-semibold text-sm">
        <p>
          <Link
            className="flex items-center justify-center gap-2"
            to={`mailto:${InstitudeInfo?.email}`}
          >
            <IoMailOpenOutline size={25} />
            <span>{InstitudeInfo?.email}</span>
          </Link>
        </p>
        {/* <p>
          <Link
            className="flex items-center justify-center gap-2"
            to={`tel:${InstitudeInfo?.phone}`}
          >
            <MdOutlineCall size={25} /> <span>{InstitudeInfo?.phone}</span>
          </Link>
        </p> */}
      </div>
      <div className="flex gap-3 items-center font-semibold text-sm">
        <Link to="/login">
          <button className="py-2 px-5 bg-header/90 hover:bg-header trans">
            Login
          </button>
        </Link>

        <Link to="/signup">
          <button className="py-2 px-5 bg-green-600 hover:bg-green-500 trans">
            Signup
          </button>
        </Link>
      </div>
    </header>
  );
}
