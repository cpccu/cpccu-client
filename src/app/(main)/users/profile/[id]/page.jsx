"use client";
import React from 'react'
import Profile from '@/components/Layout/Profile'
import { useFetchUserByIdQuery } from '@/features/users/userApi'
import { useParams } from 'next/navigation'
import { useSelector } from 'react-redux'

export default function page({ params }) {
    const loggedInUser = useSelector((state) => state.auth.user);
    const hydrated = useSelector((state) => state.auth.hydrated);
    const { id: userId } = useParams();
    
    const isOwnProfile = loggedInUser && loggedInUser._id === userId;

    const { data: userResponse, isLoading, isError } = useFetchUserByIdQuery(userId, {
        skip: !hydrated || !userId,
    });

    if (!hydrated || isLoading) {
        return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading...</div>;
    }

    if (isError || !userResponse?.data) {
        return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Error loading profile or profile not found.</div>;
    }

    return (
        <>
            <Profile user={userResponse.data} isOwnProfile={isOwnProfile} />
        </>
    )
}
