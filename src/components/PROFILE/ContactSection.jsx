import Link from "next/link";
import { Contact, Globe, Mail } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "./BrandIcons";
import { EmptyState, SectionCard } from "./SectionCard";

export function ContactSection({ member }) {
  const stripUrl = (url) => url?.replace(/^https?:\/\/(www\.)?/, "");

  const links = [
    {
      label: "Email",
      value: member.email,
      href: member.email ? `mailto:${member.email}` : undefined,
      icon: Mail,
    },
    {
      label: "GitHub",
      value: stripUrl(member.github),
      href: member.github,
      icon: GithubIcon,
    },
    {
      label: "LinkedIn",
      value: stripUrl(member.linkedin),
      href: member.linkedin,
      icon: LinkedinIcon,
    },
    {
      label: "Portfolio",
      value: stripUrl(member.portfolio),
      href: member.portfolio,
      icon: Globe,
    },
  ].filter((l) => Boolean(l.href));

  return (
    <SectionCard title="Contact & Social" icon={Contact} id="contact">
      {links.length === 0 ? (
        <EmptyState
          icon={Contact}
          title="No contact links available"
          description="This member hasn't shared any contact or social links yet."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map(({ label, value, href, icon: Icon }) => (
            <li key={label}>
              <Link
                href={href}
                target={label === "Email" ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{value}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
