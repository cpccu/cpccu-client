"use client";
import { useFetchUserByIdQuery } from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";
import { AlertTriangle, UserX } from "lucide-react";

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-36 bg-navy md:h-44" />
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative -mt-16 overflow-visible rounded-xl border border-border bg-card p-7 md:-mt-14 md:p-9">
          <div className="flex flex-col gap-7 md:flex-row md:items-start md:gap-8">
            <div className="shrink-0">
              <div className="size-32 animate-pulse rounded-xl bg-muted md:size-40" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-5 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="lg:col-span-2">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-3">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-3">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage({ params }) {
  const currentUser = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);
  const { id } = useParams();

  const isOwnProfile = currentUser && (currentUser._id === id || currentUser.uniID === id);

  const {
    data: fetchedUser,
    isLoading,
    isError,
  } = useFetchUserByIdQuery(id, {
    skip: !hydrated || isOwnProfile,
  });

  if (!hydrated) {
    return <ProfileSkeleton />;
  }

  const user = isOwnProfile ? currentUser : fetchedUser?.data;

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Unable to Load Profile</h1>
            <p className="text-gray-500">
              We couldn't load this profile. Please check your connection and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
            <UserX className="w-10 h-10 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">Profile Not Found</h1>
            <p className="text-gray-500">
              The profile you're looking for doesn't exist or may have been removed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Profile user={user} isOwnProfile={isOwnProfile} />;
}
