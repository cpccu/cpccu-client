"use client";
import {useFetchUsersQuery} from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";


export default function ProfilePage({ params }) {
  const User = useSelector((state) => state.auth.user);
  console.log(" User => ", User)
  const { id } = useParams();
  const isOwnProfile = User?._id === id;
  console.log("own profile => ", isOwnProfile)

  return <Profile user={User} isOwnProfile={isOwnProfile} />;
}
