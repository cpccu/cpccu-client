"use client";
import React from 'react'
import Profile from '@/components/Layout/Profile'
import { useFetchUserByIdQuery } from '@/features/users/userApi'
import { useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { useState } from 'react';

export default function page({ params }) {
    const loggedInUser = useSelector((state) => state.auth.user);
    const { id: userId } = useParams();
    const isOwnProfile = loggedInUser && loggedInUser._id === userId;
    console.log("Logged in user:", loggedInUser);
    console.log("Profile user ID:", userId);
    console.log("Is own profile:", isOwnProfile);
  const { data: user, isLoading, isError } = useFetchUserByIdQuery(userId, {
    skip: !userId,
  });


  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isError) {
    return <div>Error loading profile.</div>;
  }

  return (
    <>
      <Profile user={user.data} />

    </>
  )
}
