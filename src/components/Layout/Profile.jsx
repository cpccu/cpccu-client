"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt, faUserEdit, faSave, faTimes, faCloudUploadAlt } from "@fortawesome/free-solid-svg-icons";

import { useUpdateUserMutation, useUserImageUploadMutation } from "@/features/users/userApi";
import { setCredentials, clearCredentials } from "@/features/auth/authSlice";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";

const defaultAvatar = "/assets/avatar/default-avatar.png";

export default function Profile({ user, isOwnProfile }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const hydrated = useSelector((state) => state.auth.hydrated);
  
  const [updateUser, { isLoading: isUpdating, isSuccess: isUpdateSuccess, isError: isUpdateError, reset: resetUpdate }] = useUpdateUserMutation();
  const [userImageUpload, { isLoading: isImageUploading, isSuccess: isImageSuccess, isError: isImageError, reset: resetImage }] = useUserImageUploadMutation();

  const [editMode, setEditMode] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [imageFile, setImageFile] = useState(null);
  
  const [profile, setProfile] = useState({
    avatar: user?.avatar || "",
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    skills: user?.skills || [],
    uniID: user?.uniID || "", // Matches backend field
    batch: user?.batch || "",
    section: user?.section || "",
  });

  // Calculate profile completion %
  const fields = ["fullName", "email", "phone", "github", "linkedin", "skills", "uniID", "batch", "section"];
  const completion = Math.round(
    (fields.filter(f => profile[f] && (Array.isArray(profile[f]) ? profile[f].length > 0 : true)).length / fields.length) * 100
  );

  const handleLogout = () => {
    dispatch(clearCredentials());
    router.push("/login");
  };

  const handleUpdate = async () => {
    if (editMode) {
      try {
        const res = await updateUser(profile).unwrap();
        dispatch(setCredentials({ 
          user: res.data, 
          token: localStorage.getItem("token") 
        }));
        setEditMode(false);
      } catch (error) {
        console.error("Update failed:", error);
      }
    } else {
      setEditMode(true);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    const formData = new FormData();
    formData.append("image", imageFile);
    try {
      const res = await userImageUpload({ key: "avatar", imageData: formData }).unwrap();
      setProfile(prev => ({ ...prev, avatar: res.data.avatar }));
      setImageFile(null);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleAddSkill = () => {
    const trimmedSkill = newSkill.trim();
    if (!trimmedSkill) return;

    setProfile((prev) => {
      const hasDuplicate = prev.skills.some(
        (skill) => skill.trim().toLowerCase() === trimmedSkill.toLowerCase()
      );
      if (hasDuplicate) return prev;

      return { ...prev, skills: [...prev.skills, trimmedSkill] };
    });
    setNewSkill("");
  };

  const handleRemoveSkill = (skillToRemove) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  useEffect(() => {
    if (isUpdateSuccess || isUpdateError || isImageSuccess || isImageError) {
      const timer = setTimeout(() => {
        resetUpdate();
        resetImage();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isUpdateSuccess, isUpdateError, isImageSuccess, isImageError, resetUpdate, resetImage]);

  if (!hydrated) return <div className="flex justify-center items-center h-screen text-gray-500 font-medium">Loading profile...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-10 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Member Profile</h1>
          <p className="text-gray-500 mt-1">Manage your identity within the CPCCU community</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {isOwnProfile && (
            <>
              <button 
                onClick={handleLogout} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-50 transition-all shadow-sm"
              >
                <FontAwesomeIcon icon={faSignOutAlt} /> Logout
              </button>
              <button 
                onClick={handleUpdate} 
                disabled={isUpdating}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all disabled:opacity-50"
              >
                <FontAwesomeIcon icon={editMode ? faSave : faUserEdit} />
                {editMode ? (isUpdating ? "Saving..." : "Save Changes") : "Edit Profile"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile Completion Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-700 font-bold text-lg">Profile Completion</span>
          <span className="text-blue-600 font-black text-xl">{completion}%</span>
        </div>
        <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-700 ease-out" 
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Photo & Skills */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="relative group">
              <div className="w-44 h-44 rounded-full overflow-hidden border-8 border-blue-50 shadow-inner">
                <Image 
                  src={profile.avatar || defaultAvatar} 
                  alt="Avatar" 
                  width={176} 
                  height={176} 
                  className="object-cover w-full h-full"
                />
              </div>
              {editMode && (
                <label className="absolute bottom-2 right-2 bg-blue-600 text-white p-3 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                  <FontAwesomeIcon icon={faCloudUploadAlt} />
                  <input type="file" className="hidden" onChange={(e) => setImageFile(e.target.files[0])} />
                </label>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mt-6">{profile.fullName || "Member Name"}</h2>
            <p className="text-blue-600 font-semibold uppercase text-sm tracking-widest mt-1">CPCCU Member</p>

            {imageFile && (
              <button 
                onClick={handleImageUpload}
                className="mt-4 px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-all w-full"
              >
                {isImageUploading ? "Uploading..." : "Confirm New Photo"}
              </button>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Expertise & Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span key={i} className="px-4 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100 flex items-center gap-2">
                  {skill}
                  {editMode && (
                    <button onClick={() => handleRemoveSkill(skill)} className="hover:text-red-500">
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  )}
                </span>
              ))}
              {editMode && (
                <div className="flex w-full mt-4 gap-2">
                  <input 
                    value={newSkill} 
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add skill..." 
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                  />
                  <button onClick={handleAddSkill} aria-label="Add skill" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">+</button>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* Right Column: Detailed Information */}
        <div className="lg:col-span-2">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-xl font-bold text-gray-800 mb-8 pb-4 border-b border-gray-50">Personal & Academic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-10">
              {[
                { label: "Full Name", field: "fullName", placeholder: "Enter full name" },
                { label: "Email Address", field: "email", placeholder: "email@example.com" },
                { label: "Phone Number", field: "phone", placeholder: "+880 1xxx-xxxxxx" },
                { label: "University ID", field: "uniID", placeholder: "ID Number" },
                { label: "Batch Number", field: "batch", placeholder: "e.g., 60th" },
                { label: "Section", field: "section", placeholder: "e.g., A" },
                { label: "GitHub Profile", field: "github", placeholder: "https://github.com/..." },
                { label: "LinkedIn Profile", field: "linkedin", placeholder: "https://linkedin.com/in/..." },
              ].map(({ label, field, placeholder } ) => (
                <div key={field} className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase text-gray-400 tracking-widest">{label}</label>
                  {editMode ? (
                    <input 
                      type="text" 
                      value={profile[field]} 
                      onChange={(e) => setProfile({...profile, [field]: e.target.value})}
                      placeholder={placeholder}
                      className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 ring-blue-100 focus:border-blue-400 transition-all"
                    />
                  ) : (
                    <div className="text-gray-800 font-bold text-lg truncate">
                      {field === "github" || field === "linkedin" ? (
                        profile[field] ? (
                          <a href={profile[field]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{profile[field].replace(/^https?:\/\/(www\.)?/, '')}</a>
                        ) : "Not linked"
                      ) : (
                        profile[field] || "Not provided"
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {isUpdateSuccess && <SuccessAlert title="Success!" text="Your profile has been updated." />}
      {isUpdateError && <ErrorAlert title="Error" text="Failed to save profile changes." />}
      {isImageSuccess && <SuccessAlert title="Success!" text="Profile picture updated." />}
      {isImageError && <ErrorAlert title="Error" text="Failed to upload image." />}
    </div>
  );
}
