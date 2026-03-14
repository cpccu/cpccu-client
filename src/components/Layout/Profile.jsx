"use client";

import { useState, useEffect} from "react";
import Image from "next/image";
import defaultAvatar from "@/assets/avatar/default-avatar.avif";
import { useUpdateUserMutation } from "@/features/users/userApi";
import { useUserImageUploadMutation } from "@/features/users/userApi";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";

export default function ProfilePage({ user, isOwnProfile }) {
  console.log("Profile data => ", user);
  const [updateUser , { isLoading, isSuccess , isError, reset }] = useUpdateUserMutation();
  const [userImageUpload, { isLoading: isImageUploading, isSuccess: isImageUploadSuccess, isError: isImageUploadError, reset: resetImageUpload }] = useUserImageUploadMutation();
  const [profile, setProfile] = useState({
    avatar: user?.avatar || "",
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    skills: user?.skills || [],
    studentId: user?.uniID || "",
    batch: user?.batch || "",
    section: user?.section || "",
  });

  const [editMode, setEditMode] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [imageFile, setImageFile] = useState(null);

  // Calculate profile completion %
  const fields = ["fullName","email","phone","github","linkedin","skills","studentId","batch","section"];
  const completion = Math.round(
    (fields.filter(f => profile[f] && (Array.isArray(profile[f]) ? profile[f].length > 0 : true)).length / fields.length) * 100
  );

  // Handle change
  const handleChange = (field, value) => setProfile({ ...profile, [field]: value });

  // Handle image upload
  const handleImageUpload = async () => {
    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      try {
        await userImageUpload({
           key:"avatar", 
           imageData: formData 
          }).unwrap();
      } catch (error) {
        console.error("Image upload failed:", error);
      }
    }
  };

  // Add skill
  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  // Remove skill
  const removeSkill = (skill) => {
    setProfile({ ...profile, skills: profile.skills.filter(s => s !== skill) });
  };

  useEffect(() => {
    if (isSuccess || isError) {
      const timer = setTimeout(() => reset(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, reset]);


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Profile</h1>
        {isOwnProfile && (<button
          onClick={() => {
            if (editMode) {
              updateUser(profile);
              setEditMode(false);
            } else {
              setEditMode(true);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {editMode ? (isLoading ? "Saving..." : "Save") : "Edit"}
        </button>)}
      </div>
      {isSuccess && <SuccessAlert title="Profile updated successfully!" />}
      {isError && <ErrorAlert title="Failed to update profile!" text="Please try again." />}

      {/* Profile Progress */}
      <div className="mb-4">
        <p className="text-gray-700 font-semibold mb-1">Profile Completion: {completion}%</p>
        <div className="w-full bg-gray-200 h-3 rounded-full">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row gap-6 bg-white shadow-lg rounded-xl p-6">
        {/* Left: Picture */}
        <div className="flex flex-col items-center gap-4 md:w-1/3">
          <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-200">
            <Image
              src={profile.avatar || defaultAvatar}
              alt="Profile Picture"
              width={160}
              height={160}
              className="object-cover"
            />
          </div>
          {editMode && (
            <>
              <input
              type="file"
              placeholder="Profile Picture"
              onChange={(e) => setImageFile(e.target.files[0])}
              className="border px-2 py-1 rounded-md w-full text-sm"
            />
            <button
              onClick={handleImageUpload}
              disabled={isImageUploading}
              className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition w-full"
            >
              {isImageUploading ? "Uploading..." : "Upload Picture"}
            </button>
            </>
          )}
        </div>

        {/* Right: Info */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Full Name", field: "fullName" },
            { label: "Email", field: "email" },
            { label: "Phone", field: "phone" },
            { label: "Student ID", field: "studentId" },
            { label: "Batch", field: "batch" },
            { label: "Section", field: "section" },
            { label: "GitHub", field: "github" },
            { label: "LinkedIn", field: "linkedin" },
          ].map(({ label, field }) => (
            <div key={field} className="flex flex-col">
              <span className="font-semibold text-gray-600">{label}</span>
              {editMode ? (
                <input
                  type="text"
                  value={profile[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="border px-2 py-1 rounded-md"
                />
              ) : (
                ["github", "linkedin"].includes(field) ? (
                  profile[field] ? (
                    <a
                      href={profile[field]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline block max-w-full truncate"
                      title={profile[field]}
                    >
                      {profile[field]}
                    </a>
                  ) : (
                    <p className="text-gray-400">-</p>
                  )
                ) : (
                  <p className="text-gray-800">{profile[field] || "-"}</p>
                )
              )}
            </div>
          ))}

          {/* Skills */}
          <div className="flex flex-col md:col-span-2">
            <span className="font-semibold text-gray-600">Skills</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.skills.length > 0 ? (
                profile.skills.map((skill) => (
                  <div
                    key={skill}
                    className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                  >
                    {skill}
                    {editMode && (
                      <button onClick={() => removeSkill(skill)} className="text-red-500 font-bold">x</button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400">No skills added</p>
              )}
            </div>
            {editMode && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add skill"
                  className="border px-2 py-1 rounded-md flex-1"
                />
                <button
                  onClick={addSkill}
                  className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}