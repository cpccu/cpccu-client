"use client";

import { useRef, useState } from "react";
import JoditEditor from "jodit-react";
import InputBox from "@/components/LOGINSIGNUP/InputBox";

export default function ProfileBlogModal() {
  const editor = useRef(null);
  const [content, setContent] = useState("");
  return (
    <section className="fixed px-5 top-0 left-0 right-0 bottom-0 z-50 backdrop-blur-sm flex items-center justify-center ">
      <main className=" w-full lg:w-1/2 bg-white flex flex-col gap-3 p-5 shadow-lg">
        <section className="flex flex-col lg:flex-row gap-3">
          <input
            className="px-3 py-2 rounded w-full border"
            type="text"
            placeholder="write your blog"
          />
          <input
            className="px-3 py-2 rounded border w-full"
            type="text"
            placeholder="photo url"
          />
        </section>
        <textarea
          className="px-3 py-2 rounded border"
          placeholder="write your short description"
        ></textarea>
        <JoditEditor
          ref={editor}
          value={content}
          onChange={(newContent) => setContent(newContent)}
        />

        <button className="h-10 px-5 bg-header text-white  border self-start mx-auto">
          Post
        </button>
      </main>
    </section>
  );
}
