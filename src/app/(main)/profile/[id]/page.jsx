"use client";
import {useFetchUsersQuery} from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";


export default function ProfilePage({ params }) {
  const User = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);
  const { id } = useParams();
  if (!hydrated) {
    return <div>loading...</div>;
  }
  const isOwnProfile = User?._id === id;

  return <Profile user={User} isOwnProfile={isOwnProfile} />;
}
