"use client";

import { useState } from "react";
import ProfileBlogModal from "@/components/PROFILE/Profile_Blog_Modal";

export default function ProfileBlog() {
  return (
    <main className="flex flex-col gap-6">
      <BlogWrite />
      <BlogSection />
    </main>
  );
}

function BlogWrite() {
  const [blogWrite, setBlogWrite] = useState(false);

  const OpenBlogWriter = () => {
    setBlogWrite(true);
  };

  return (
    <>
      <main className="bg-white mx-5 px-5 py-4 lg:mx-0 rounded-lg flex gap-3">
        <div className="h-9 w-9 rounded-full shrink-0 bg-green-900">
          <img src="" alt="Profile" />
        </div>
        <button
          onClick={OpenBlogWriter}
          className="h-9 text-left text-black/50 bg-responsibility hover:ring-1 ring-blue-600 trans w-full rounded-full px-6 cursor-pointer"
        >
          write your blog
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
