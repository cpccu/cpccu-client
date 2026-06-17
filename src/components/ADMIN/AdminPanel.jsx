"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  FileText,
  House,
  Search,
  Shield,
  Users,
} from "lucide-react";
import {
  useGetAdminMembersQuery,
  useGetAdminOverviewQuery,
  useUpdateAdminMemberMutation,
} from "@/features/admin/adminApi";
import {
  useGetCertificateStatsQuery,
  useGetRecentCertificatesQuery,
} from "@/features/certificate/certificateApi";

const roles = ["admin", "moderator", "mentor", "member"];

const getErrorMessage = (error) =>
  error?.data?.message || "The admin request could not be completed.";

const getInitials = (name = "CP") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-blue-700" />
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-950">{value ?? "-"}</p>
    </article>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { hydrated, user } = useSelector((state) => state.auth);
  const isAdmin = user?.roles?.role === "admin";
  const isModerator = user?.roles?.role === "moderator";
  const isMentor = user?.roles?.role === "mentor";
  const canAccessAdmin = isAdmin || isModerator || isMentor;
  const [search, setSearch] = useState("");
  const {
    data: overviewResponse,
    error: overviewError,
    isLoading: isOverviewLoading,
  } = useGetAdminOverviewQuery(undefined, { skip: !isAdmin });
  const {
    data: membersResponse,
    error: membersError,
    isLoading: isMembersLoading,
  } = useGetAdminMembersQuery(undefined, { skip: !isAdmin });
  const { data: certificateStatsResponse } = useGetCertificateStatsQuery(
    undefined,
    { skip: !isAdmin }
  );
  const { data: recentCertificatesResponse } = useGetRecentCertificatesQuery(
    undefined,
    { skip: !isAdmin }
  );
  const [updateMember, { error: updateError, isLoading: isUpdating }] =
    useUpdateAdminMemberMutation();

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, router, user]);

  const members = membersResponse?.data || [];
  const overview = overviewResponse?.data;
  const certificateStats = certificateStatsResponse?.data;
  const recentCertificates = recentCertificatesResponse?.data || [];
  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return members;
    }

    return members.filter((member) =>
      [member.fullName, member.email, member.uniID, member.roles?.role]
        .filter(Boolean)
        .some((value) => value.toString().toLowerCase().includes(term))
    );
  }, [members, search]);

  const updateRole = async (member, role) => {
    await updateMember({
      id: member._id,
      role,
      position: member.roles?.position || 0,
      positionName:
        role === member.roles?.role
          ? member.roles?.positionName
          : role,
    });
  };

  const updateValidation = async (member) => {
    await updateMember({ id: member._id, isValid: !member.isValid });
  };

  if (!hydrated) {
    return <p className="p-8 text-slate-600">Loading admin access...</p>;
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="min-h-svh bg-slate-100 p-6 md:p-12">
        <section className="mx-auto max-w-xl border border-slate-200 bg-white p-8 shadow-sm">
          <Shield className="h-8 w-8 text-blue-700" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            Admin access required
          </h1>
          <p className="mt-2 text-slate-600">
            This panel is connected to protected CPCCU admin APIs.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 bg-blue-950 px-4 py-2 font-semibold text-white"
          >
            <House className="h-4 w-4" />
            Return to website
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-slate-100 text-slate-950">
      <div className="grid min-h-svh lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-200 bg-blue-950 p-5 text-white lg:border-b-0">
          <Link href="/" className="inline-flex items-center gap-2 font-bold">
            <House className="h-4 w-4" />
            CPCCU Website
          </Link>
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase text-blue-200">
              Admin Panel
            </p>
            <h1 className="mt-2 text-2xl font-bold">Operations</h1>
            <p className="mt-2 text-sm text-blue-100">
              Connected members, certificates, and site counts.
            </p>
          </div>
          <nav className="mt-8 grid gap-2 text-sm font-semibold">
            <a href="#overview" className="bg-white/10 px-3 py-2">
              Overview
            </a>
            <a href="#members" className="px-3 py-2 hover:bg-white/10">
              Members
            </a>
            <a href="#certificates" className="px-3 py-2 hover:bg-white/10">
              Certificates
            </a>
          </nav>
        </aside>

        <section className="p-4 md:p-8">
          <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                Signed in as {user.fullName}
              </p>
              <h2 className="text-3xl font-bold">CPCCU Admin</h2>
            </div>
            <p className="max-w-xl text-sm text-slate-600">
              Member approvals and roles below write to the live server.
            </p>
          </header>

          <section id="overview" className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="Members"
                value={isOverviewLoading ? "..." : overview?.totalMembers}
              />
              <StatCard
                icon={BadgeCheck}
                label="Verified"
                value={isOverviewLoading ? "..." : overview?.verifiedMembers}
              />
              <StatCard
                icon={Shield}
                label="Admins"
                value={isOverviewLoading ? "..." : overview?.adminMembers}
              />
              <StatCard
                icon={FileText}
                label="Posts"
                value={isOverviewLoading ? "..." : overview?.totalPosts}
              />
            </div>
            {overviewError && (
              <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(overviewError)}
              </p>
            )}
          </section>

          <section id="members" className="mt-8 border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-bold">Members</h3>
                <p className="text-sm text-slate-600">
                  Approve registrations and set club roles.
                </p>
              </div>
              <label className="flex min-w-0 items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-2 md:w-80">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  placeholder="Search members"
                />
              </label>
            </div>
            {membersError && (
              <p className="m-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(membersError)}
              </p>
            )}
            {updateError && (
              <p className="m-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(updateError)}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-4">Member</th>
                    <th className="p-4">University ID</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Access</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => (
                    <tr key={member._id} className="border-t border-slate-100">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-950">
                              {getInitials(member.fullName)}
                            </span>
                          )}
                          <span>
                            <strong className="block">{member.fullName}</strong>
                            <span className="text-slate-500">{member.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{member.uniID || "-"}</td>
                      <td className="p-4">
                        <select
                          value={member.roles?.role || "member"}
                          onChange={(event) => updateRole(member, event.target.value)}
                          disabled={isUpdating}
                          className="border border-slate-300 bg-white px-3 py-2 font-semibold"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 font-semibold ${
                            member.isValid
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {member.isValid ? "Verified" : "Pending"}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          disabled={isUpdating}
                          onClick={() => updateValidation(member)}
                          className="border border-blue-950 px-3 py-2 font-semibold text-blue-950 disabled:opacity-50"
                        >
                          {member.isValid ? "Mark pending" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isMembersLoading && visibleMembers.length === 0 && (
                <p className="p-6 text-slate-600">No members matched.</p>
              )}
              {isMembersLoading && <p className="p-6 text-slate-600">Loading members...</p>}
            </div>
          </section>

          <section
            id="certificates"
            className="mt-8 grid gap-4 xl:grid-cols-[280px_1fr]"
          >
            <article className="border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-500">Certificates</p>
              <p className="mt-3 text-4xl font-bold">
                {certificateStats?.totalCertificates ??
                  overview?.totalCertificates ??
                  "-"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Public verification data is already live on the website.
              </p>
            </article>
            <article className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-4">
                <h3 className="text-xl font-bold">Recent certificates</h3>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {recentCertificates.slice(0, 4).map((certificate) => (
                  <div
                    key={certificate._id || certificate.certificateId}
                    className="border border-slate-100 bg-slate-50 p-3"
                  >
                    <p className="font-bold">{certificate.recipientName}</p>
                    <p className="text-sm text-slate-600">
                      {certificate.certificateId} - {certificate.contestName}
                    </p>
                  </div>
                ))}
                {recentCertificates.length === 0 && (
                  <p className="text-slate-600">No recent certificates found.</p>
                )}
              </div>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}
