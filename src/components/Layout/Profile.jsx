"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSignOutAlt, faUserEdit, faSave, faTimes, faCloudUploadAlt } from "@fortawesome/free-solid-svg-icons";
import { FaAngleRight } from "react-icons/fa6";

import { useUpdateUserMutation, useUserImageUploadMutation } from "@/features/users/userApi";
import { setCredentials, clearCredentials } from "@/features/auth/authSlice";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";
import ImageUploadModal from "../PROFILE/ImageUploadModal";

const defaultAvatar = "/assets/avatar/default-avatar.png";

export default function Profile({ user, isOwnProfile }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const token = useSelector((state) => state.auth.token);
  const [updateUser, { isLoading: isUpdating, isSuccess: isUpdateSuccess, isError: isUpdateError, reset: resetUpdate }] = useUpdateUserMutation();
  const [userImageUpload, { isLoading: isImageUploading, isSuccess: isImageSuccess, isError: isImageError, error: uploadError, reset: resetImage }] = useUserImageUploadMutation();

  const [editMode, setEditMode] = useState(false);
  const [newSkill, setNewSkill] = useState({ skillName: "", experience: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
    router.push("/");
  };

  const handleUpdate = async () => {
    if (editMode) {
      try {
        const res = await updateUser(profile).unwrap();
        dispatch(setCredentials({ 
          user: res.data, 
          token
        }));
        setEditMode(false);
      } catch (error) {
        console.error("Update failed:", error);
      }
    } else {
      setEditMode(true);
    }
  };

  const handleImageUpload = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await userImageUpload({ key: "avatar", imageData: formData }).unwrap();
      setProfile(prev => ({ ...prev, avatar: res.data.avatar }));
      setIsModalOpen(false);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleAddSkill = () => {
    const trimmedSkillName = newSkill.skillName.trim();
    const trimmedExperience = newSkill.experience.trim();
    
    if (!trimmedSkillName || !trimmedExperience) return;

    setProfile((prev) => {
      const hasDuplicate = prev.skills.some(
        (skill) => skill.skillName.trim().toLowerCase() === trimmedSkillName.toLowerCase()
      );
      if (hasDuplicate) return prev;

      return { 
        ...prev, 
        skills: [...prev.skills, { skillName: trimmedSkillName, experience: trimmedExperience }] 
      };
    });
    setNewSkill({ skillName: "", experience: "" });
  };

  const handleRemoveSkill = (skillToRemove) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill.skillName !== skillToRemove.skillName),
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

      {/* Profile Completion Bar - Only visible to owner */}
      {isOwnProfile && (
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
      )}

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
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="absolute bottom-2 right-2 bg-blue-600 text-white p-3 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg"
                >
                  <FontAwesomeIcon icon={faCloudUploadAlt} />
                </button>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mt-6">{profile.fullName || "Member Name"}</h2>
            <p className="text-blue-600 font-semibold uppercase text-sm tracking-widest mt-1">CPCCU Member</p>
          </div>

          {/* Expertise & Skills Section - Matching Job Pipeline UI */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg md:text-xl font-bold text-blue-600 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              Expertise & Skills
            </h3>
            
            <div className="flex flex-col gap-3">
              {profile.skills && profile.skills.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {profile.skills.map((skill, index) => (
                    <li key={`${skill.skillName}-${index}`} className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <FaAngleRight className="text-blue-600 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900">{skill.skillName}: </span>
                          <span className="text-gray-700">{skill.experience}</span>
                        </div>
                      </div>
                      {editMode && (
                        <button 
                          onClick={() => handleRemoveSkill(skill)}
                          className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0 mt-1"
                          aria-label="Remove skill"
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm italic">No skills added yet</p>
              )}
              
              {editMode && (
                <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col gap-3">
                  <input 
                    value={newSkill.skillName} 
                    onChange={(e) => setNewSkill({...newSkill, skillName: e.target.value})}
                    placeholder="Skill name (e.g., React)" 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                  <input 
                    value={newSkill.experience} 
                    onChange={(e) => setNewSkill({...newSkill, experience: e.target.value})}
                    placeholder="Experience (e.g., 2+ years)" 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
                  />
                  <button 
                    onClick={handleAddSkill} 
                    aria-label="Add skill" 
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    + Add Skill
                  </button>
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

      {/* Upload Modal */}
      <ImageUploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onUpload={handleImageUpload}
        isUploading={isImageUploading}
      />

      {/* Alerts */}
      {isUpdateSuccess && <SuccessAlert title="Success!" text="Your profile has been updated." />}
      {isUpdateError && <ErrorAlert title="Error" text="Failed to save profile changes." />}
      {isImageSuccess && <SuccessAlert title="Success!" text="Profile picture updated." />}
      {isImageError && <ErrorAlert title="Upload Failed" text={uploadError?.data?.message || "Failed to upload image."} />}
    </div>
  );
}