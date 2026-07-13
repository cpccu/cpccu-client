"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, BriefcaseBusiness, Edit3, Globe, GraduationCap, IdCard, LogOut, Mail, User } from "lucide-react";
import { AchievementBadges } from "./AchievementBadges";
import { GithubIcon, LinkedinIcon } from "./BrandIcons";
import { cn } from "@/lib/utils";

const defaultAvatar = "/assets/avatar/default-avatar.png";

const roleIcons = {
  President: "👑",
  "Vice President": "👑",
  "General Secretary": "🛡",
  Treasurer: "💼",
  Advisor: "🎓",
  Moderator: "🏅",
  "Former President": "🎖",
  "Former Vice President": "🎖",
  Alumni: "👨‍🎓",
};

function getRoleIcon(role) {
  return roleIcons[role] ?? "⭐";
}

export function ProfileHero({ member, isOwner, editMode, onEditToggle, onJobPipeline, onLogout, avatarUrl, onImageUploadClick }) {
  const socials = [
    { label: "GitHub", href: member.github, icon: GithubIcon },
    { label: "LinkedIn", href: member.linkedin, icon: LinkedinIcon },
    { label: "Portfolio", href: member.portfolio, icon: Globe },
    { label: "Email", href: member.email ? `mailto:${member.email}` : undefined, icon: Mail },
  ].filter((s) => Boolean(s.href));

  return (
    <section aria-label="Member overview" className="relative">
      <div className="h-36 bg-navy md:h-44">
        <div className="mx-auto flex h-full max-w-6xl items-start justify-between px-4 pt-6 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-foreground/70">
            CPCCU Member Profile
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              member.status === "Executive"
                ? "bg-accent text-accent-foreground"
                : member.status === "Alumni"
                  ? "bg-muted text-muted-foreground"
                  : "bg-success/10 text-success",
            )}
          >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {member.status}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative -mt-16 overflow-visible rounded-xl border border-border bg-card p-7 shadow-[0_16px_45px_rgba(15,37,87,0.08)] md:-mt-14 md:p-9">
          <div
            className="pointer-events-none absolute inset-x-4 top-20 h-44 max-w-6xl overflow-hidden rounded-xl opacity-[0.03] md:inset-x-auto md:left-1/2 md:top-24 md:w-[72rem] md:-translate-x-1/2"
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#0f2557_1px,transparent_0)] bg-[length:18px_18px]" />
            <div className="absolute right-8 top-6 font-mono text-5xl font-bold text-navy">&#x7b;&#x7d; &#x3c;&#x3e; 0101</div>
          </div>
          <div className="relative flex flex-col gap-7 md:flex-row md:items-start md:gap-8">
            <div className="relative -mt-20 shrink-0 md:-mt-24">
              <div className="relative">
                <Image
                  src={avatarUrl || defaultAvatar}
                  alt={`Profile photo of ${member.fullName}`}
                  width={144}
                  height={144}
                  priority
                  className="size-32 rounded-xl border-4 border-card bg-white object-contain object-center shadow-md md:size-40"
                />
                {isOwner && editMode && (
                  <button
                    type="button"
                    onClick={onImageUploadClick}
                    className="absolute bottom-2 right-2 bg-blue-600 text-white p-2.5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg"
                    aria-label="Change profile photo"
                  >
                    <Edit3 className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-[1.7rem] font-bold leading-tight text-foreground text-balance md:text-4xl">
                {member.fullName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm">
                  {getRoleIcon(member.officialRole)} {member.officialRole}
                </span>
              </div>

              <AchievementBadges badges={member.achievementBadges} />

              <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Department</dt>
                  <dd className="text-muted-foreground">
                    {member.department}
                    {member.batch ? ` · ${member.batch}` : ""}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <IdCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">University ID</dt>
                  <dd className="text-muted-foreground">{member.universityId}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Member since</dt>
                  <dd className="text-muted-foreground">Member since {member.memberSince}</dd>
                </div>
              </dl>

              {socials.length > 0 && (
                <ul className="mt-6 flex flex-wrap items-center gap-2.5" aria-label="Social links">
                  {socials.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        target={label === "Email" ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                       >
                         <Icon className="size-3.5" aria-hidden="true" />
                         {label}
                       </Link>
                     </li>
                  ))}
                </ul>
              )}
            </div>

            {isOwner && (
              <div className="flex w-full flex-wrap gap-2 md:w-48 md:shrink-0 md:flex-col">
                <button
                  type="button"
                  onClick={() => onEditToggle && onEditToggle()}
                  className="inline-flex h-10 min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:w-full"
                >
                  <Edit3 className="size-4" aria-hidden="true" />
                  {editMode ? "Cancel Editing" : "Edit Profile"}
                </button>
                <button
                  type="button"
                  onClick={onJobPipeline}
                  className="inline-flex h-10 min-w-40 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:w-full"
                >
                  <BriefcaseBusiness className="size-4" aria-hidden="true" />
                  Job Pipeline
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex h-10 min-w-40 items-center justify-center gap-2 rounded-lg border border-red-200 bg-card px-4 text-sm font-bold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:w-full"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
