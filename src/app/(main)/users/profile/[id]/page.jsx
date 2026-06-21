"use client";
import React from 'react'
import Profile from '@/components/Layout/Profile'
import { useFetchUserByIdQuery } from '@/features/users/userApi'
import { useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, UserX } from "lucide-react";

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <Skeleton className="h-12 w-32 rounded-2xl" />
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-16" />
        </div>
        <Skeleton className="h-4 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <Skeleton className="w-44 h-44 rounded-full" />
            <Skeleton className="h-7 w-3/4 mt-6" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="w-4 h-4 mt-1" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-full">
            <Skeleton className="h-7 w-64 mb-8 pb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-10">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function page({ params }) {
    const loggedInUser = useSelector((state) => state.auth.user);
    const hydrated = useSelector((state) => state.auth.hydrated);
    const { id: userId } = useParams();

    const isOwnProfile = loggedInUser && (loggedInUser._id === userId || loggedInUser.uniID === userId);

    const { data: userResponse, isLoading, isError } = useFetchUserByIdQuery(userId, {
        skip: !hydrated || isOwnProfile,
    });

    if (!hydrated) {
        return <ProfileSkeleton />;
    }

    if (isOwnProfile) {
        if (!loggedInUser) {
            return (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center space-y-6 max-w-md">
                  <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                    <UserX className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">Profile Not Found</h1>
                    <p className="text-gray-500">
                      Please log in to view your profile.
                    </p>
                  </div>
                </div>
              </div>
            );
        }
        return (
            <>
                <Profile user={loggedInUser} isOwnProfile={isOwnProfile} />
            </>
        );
    }

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

    if (!userResponse?.data) {
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

    return (
        <>
            <Profile user={userResponse.data} isOwnProfile={isOwnProfile} />
        </>
    )
}
