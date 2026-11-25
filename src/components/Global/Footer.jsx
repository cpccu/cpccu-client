import {
  faFacebookF,
  faGithub,
  faLinkedinIn,
  faWhatsapp,
  faDiscord,
} from "@fortawesome/free-brands-svg-icons";
import { faArrowUpRightFromSquare, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import InstituteInfo from "@/data/global/institude.json";
import Link from "next/link";

const socialIcons = [faFacebookF, faWhatsapp, faLinkedinIn, faGithub, faDiscord];
const socialNames = ["Facebook", "WhatsApp", "LinkedIn", "GitHub", "Discord"];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="site-footer">
        <div className="site-footer-main padding">
          <FooterInfo />
          <Touch />
          <FooterLinks title={InstituteInfo?.useFullLink?.header} items={InstituteInfo?.useFullLink?.element} />
          <FooterLinks title={InstituteInfo?.org?.header} items={InstituteInfo?.org?.element} />
        </div>
        <div className="site-footer-bottom padding">
          <span>{currentYear} © {InstituteInfo?.rights}</span>
          <a href="https://ossccu.pro.bd/" target="_blank" rel="noopener noreferrer">
            {InstituteInfo?.developedBy} <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </>
  );
}

function FooterInfo() {
  return (
    <section className="site-footer-about">
      <Link href="/" className="site-footer-brand">
        <img src={InstituteInfo?.img} alt={InstituteInfo?.alt || "CPCCU"} />
        <span><strong>CPCCU</strong><small>{InstituteInfo?.uniName}</small></span>
      </Link>
      <p>Sharpen your skills. Compete with the best. Excel together.</p>
      <a className="site-footer-email" href={`mailto:${InstituteInfo?.email}`}>
        <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" /> {InstituteInfo?.email}
      </a>
    </section>
  );
}

function Touch() {
  return (
    <section className="site-footer-connect">
      <h2>{InstituteInfo?.Footer2?.header}</h2>
      <p>{InstituteInfo?.Footer2?.conText}</p>
      <div className="site-footer-socials">
        {InstituteInfo?.media?.map((item, index) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visit CPCCU on ${socialNames[index] || "social media"}`}
          >
            {socialIcons[index] && <FontAwesomeIcon icon={socialIcons[index]} aria-hidden="true" />}
          </a>
        ))}
      </div>
    </section>
  );
}

function FooterLinks({ title, items = [] }) {
  return (
    <section className="site-footer-links">
      <h2>{title}</h2>
      <ul>
        {items?.map((item) => {
          const internal = item.url === "signup" || item.url.startsWith("/");
          const content = <>{item.linkName}<FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" /></>;
          return (
            <li key={item.url}>
              {internal ? (
                <Link href={item.url === "signup" ? "/signup" : item.url}>{content}</Link>
              ) : (
                <a href={item.url} target="_blank" rel="noopener noreferrer">{content}</a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
