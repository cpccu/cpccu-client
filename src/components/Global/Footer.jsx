import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-regular-svg-icons";
import { faFacebookF } from "@fortawesome/free-brands-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faLinkedinIn } from "@fortawesome/free-brands-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons";
import InstituteInfo from "@/data/global/institude.json";
import Link from "next/link";
import { faDiscord } from "@fortawesome/free-brands-svg-icons";

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      <main className="bg-count text-white padding grid justify-between gap-y-8 md:gap-y-12 md:gap-x-6 grid-cols-2 lg:grid-cols-11 py-10 md:py-16 lg:py-12">
        <FooterInfo />
        <Touch />
        <UsefullLink />
        <OrgLink />
      </main>
      {/* rights section start */}
      <footer className="bg-header text-white/90 h-16 flex items-center justify-center text-center">
        {currentYear} &copy;{InstituteInfo?.rights}
      </footer>
      {/* rights section end */}
    </>
  );
}

// logo and information section start

export function FooterInfo() {
  return (
    <main className="flex flex-col gap-5 col-span-2 md:col-span-1 lg:col-span-4">
      <section className="flex items-center gap-2">
        <img
          className="h-14 filter grayscale"
          src={InstituteInfo?.img}
          alt={InstituteInfo?.alt}
        />
        <div>
          <h1 className="text-2xl font-bold font-custom">
            {InstituteInfo?.name}
          </h1>
          <p className="text-sm">{InstituteInfo?.shortName}</p>
        </div>
      </section>

      <div>
        {" "}
        <ul className=" list-disc pl-5">
          {InstituteInfo?.Footer1?.list.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        {InstituteInfo?.Footer1.conText}
      </div>

      <section className="flex flex-col items-start gap-2 font-semibold text-sm">
        <Link href={`mailto:${InstituteInfo?.email}`}>
          <button>Email: {InstituteInfo?.email}</button>
        </Link>
        {/* <Link href={`tel:${InstituteInfo?.phone}`}>
          <button>Hotline: {InstituteInfo?.phone}</button>
        </Link> */}
      </section>
    </main>
  );
}

// logo and information section end

// Get In Touch section start

export function Touch() {
  const Allicon = [faFacebookF, faWhatsapp, faLinkedinIn, faGithub, faDiscord];
  return (
    <section className="col-span-2 md:col-span-1 lg:col-span-3">
      <h1 className="text-2xl font-bold mb-3 md:mb-9">
        {InstituteInfo?.Footer2.header}
      </h1>
      <main className="flex flex-col gap-6">
        <p>{InstituteInfo?.Footer2.conText}</p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="ring-1 ring-header h-12 flex"
        >
          <input
            className="w-[80%] bg-header/10 placeholder:capitalize outline-none p-3 placeholder:font-semibold"
            type="email"
            placeholder="Enter your email"
            required
          />
          <button className="bg-header hover:bg-header-hover w-[21%] trans">
            <FontAwesomeIcon className="h-5" icon={faPaperPlane} />
          </button>
        </form>

        <section className="flex gap-5 flex-wrap">
          {InstituteInfo?.media.map((item, index) => (
            <Link
              key={index}
              href={item?.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="bg-header hover:bg-header-hover trans flex items-center justify-center px-3 py-2 w-10 h-10">
                <FontAwesomeIcon className="w-7 h-7" icon={Allicon[index]} />
              </button>
            </Link>
          ))}
        </section>
      </main>
    </section>
  );
}

// Get In Touch section end

// Usefull Link start

export function UsefullLink() {
  return (
    <section className="lg:col-span-2">
      <h1 className="text-2xl font-bold mb-3 md:mb-9">
        {InstituteInfo?.useFullLink.header}
      </h1>
      <ul className="flex flex-col gap-[.7rem] ml-5">
        {InstituteInfo?.useFullLink.element.map((item, index) => (
          <Link
            key={index}
            href={item?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <li className="flex items-center gap-4 cursor-pointer hover:text-header hover:translate-x-2 trans">
              <FontAwesomeIcon
                className="rotate-180 pb-[.3rem]"
                icon={faAngleLeft}
              />
              <p>{item?.linkName}</p>
            </li>
          </Link>
        ))}
      </ul>
    </section>
  );
}

// Usefull Link end

// org link start

export function OrgLink() {
  return (
    <section className="lg:col-span-2">
      <h1 className="text-2xl font-bold mb-3 md:mb-9">
        {InstituteInfo?.org.header}
      </h1>
      <ul className="flex flex-col gap-[.7rem] ml-5">
        {InstituteInfo?.org.element.map((item, index) => (
          <Link
            key={index}
            href={item?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <li className="flex items-center gap-4 cursor-pointer hover:text-header hover:translate-x-2 trans">
              <FontAwesomeIcon
                className="rotate-180 pb-[.3rem]"
                icon={faAngleLeft}
              />
              <p>{item?.linkName}</p>
            </li>
          </Link>
        ))}
      </ul>
    </section>
  );
}

// org link end
