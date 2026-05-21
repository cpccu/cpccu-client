"use client";

import { useState } from "react";
import ProfileBlogModal from "@/components/PROFILE/Profile_Blog_Modal";

export default function ProfileBlog({ user, isOwnProfile }) {
  return (
    <main className="flex flex-col gap-6">
      <BlogWrite user={user} isOwnProfile={isOwnProfile} />
      <BlogSection />
    </main>
  );
}

function BlogWrite({ user, isOwnProfile }) {
  const [blogWrite, setBlogWrite] = useState(false);
  const defaultAvatar = "/assets/avatar/default-avatar.png";

  const OpenBlogWriter = () => {
    setBlogWrite(true);
  };

  if (!isOwnProfile) return null;

  return (
    <>
      <main className="bg-white mx-5 px-5 py-4 lg:mx-0 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-center">
        <div className="h-10 w-10 rounded-full shrink-0 overflow-hidden border border-gray-100">
          <img src={user?.avatar || defaultAvatar} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <button
          onClick={OpenBlogWriter}
          className="h-10 text-left text-gray-400 bg-gray-50 hover:bg-gray-100 trans w-full rounded-full px-6 cursor-pointer font-medium"
        >
          Share something with the community...
        </button>
      </main>
      {/* blog writer start */}
      {blogWrite ? <ProfileBlogModal /> : null}
      {/* blog writer end */}
    </>
  );
}

function BlogSection() {
  return <main className="h-svh bg-white rounded-lg"></main>;
}
