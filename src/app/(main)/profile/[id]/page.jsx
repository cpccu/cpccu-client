"use client";
import {useFetchUserByIdQuery} from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";


export default function ProfilePage({ params }) {
  const User = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);
  const { id } = useParams();
  if (!hydrated) {
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading...</div>;
  }
  const isOwnProfile = User?._id === id;

  const { data: fetchedUser, isLoading } = useFetchUserByIdQuery(id, { skip: isOwnProfile });
  const user = isOwnProfile ? User : fetchedUser;

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading profile...</div>;
  }

  if (!user) {
    return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Profile not found</div>;
  }

  return <Profile user={user} isOwnProfile={isOwnProfile} />;
}
