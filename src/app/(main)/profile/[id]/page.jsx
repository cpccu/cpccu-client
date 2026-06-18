"use client";
import { useFetchUserByIdQuery } from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";

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
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading...</div>;
  }

  const user = isOwnProfile ? currentUser : fetchedUser?.data;

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading profile...</div>;
  }

  if (isError || !user) {
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Profile not found</div>;
  }

  return <Profile user={user} isOwnProfile={isOwnProfile} />;
}
