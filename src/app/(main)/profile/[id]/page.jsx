"use client";
import {useFetchUsersQuery} from "@/features/users/userApi";
import Profile from "@/components/Layout/Profile";


export default function ProfilePage({ params }) {
  const { data: user, isLoading, isError } = useFetchUsersQuery();

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isError) {
    return <div>Error loading profile.</div>;
  }
  return <Profile user={user.data} />;
}
