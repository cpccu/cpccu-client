"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import {
  useFetchUsersQuery,
  useRemoveJobPipelineProfileMutation,
  useRequestJobPipelineProfileMutation,
  useUpdateUserMutation,
  useUserImageUploadMutation,
} from "@/features/users/userApi";
import { useLazyVerifyCertificateQuery } from "@/features/certificate/certificateApi";
import { setCredentials, clearCredentials } from "@/features/auth/authSlice";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";
import ImageUploadModal from "../PROFILE/ImageUploadModal";
import ProfileImageCropModal from "../PROFILE/ProfileImageCropModal";
import { isValidStudentId, detectScientificNotation, normalizeStudentId } from "@/lib/id-validation";

import { ProfileHero } from "@/components/PROFILE/ProfileHero";
import { QuickStats } from "@/components/PROFILE/QuickStats";
import { AboutSection } from "@/components/PROFILE/AboutSection";
import { MemberInfoSection } from "@/components/PROFILE/MemberInfoSection";
import { ContactSection } from "@/components/PROFILE/ContactSection";
import { SkillsSection } from "@/components/PROFILE/SkillsSection";
import { CertificatesSection } from "@/components/PROFILE/CertificatesSection";
import { ProjectsSection } from "@/components/PROFILE/ProjectsSection";

const defaultAvatar = "/assets/avatar/default-avatar.png";

const ROLE_STATUS_MAP = {
  admin: "Executive",
  moderator: "Executive",
  mentor: "Executive",
  member: "Active",
};

function getRoleStatus(role) {
  return ROLE_STATUS_MAP[role] || "Active";
}

function deriveAchievementBadges(user) {
  const badges = [];
  if (user?.roles?.role && user.roles.role !== "member") {
    badges.push(`⭐ ${user.roles.positionName || "Executive"}`);
  }
  if (user?.jobPipelineStatus === "approved") {
    badges.push("💼 Job Pipeline");
  }
  if (user?.jobPipelineStatus === "pending") {
    badges.push("⏳ Pending Review");
  }
  return badges;
}

function mapSkillsToGroups(skills = []) {
  if (!skills.length) return [];
  return [
    {
      category: "Skills",
      skills: skills.map((s) => s.skillName),
      level: "Intermediate",
    },
  ];
}

export default function Profile({ user, isOwnProfile }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const token = useSelector((state) => state.auth.token);
  const [updateUser, { isLoading: isUpdating, isSuccess: isUpdateSuccess, isError: isUpdateError, reset: resetUpdate }] = useUpdateUserMutation();
  const [userImageUpload, { isLoading: isImageUploading, isSuccess: isImageSuccess, isError: isImageError, error: uploadError, reset: resetImage }] = useUserImageUploadMutation();
  const [requestJobPipelineProfile, { isLoading: isRequestingJobPipeline, isSuccess: isJobPipelineSuccess, isError: isJobPipelineError, error: jobPipelineError, reset: resetJobPipeline }] = useRequestJobPipelineProfileMutation();
  const [removeJobPipelineProfile, { isLoading: isRemovingJobPipeline }] = useRemoveJobPipelineProfileMutation();
  const [fetchCertificates, { data: certResponse }] = useLazyVerifyCertificateQuery();
  const { data: currentUserResponse } = useFetchUsersQuery(undefined, {
    skip: !isOwnProfile || !token,
    pollingInterval: 5000,
    refetchOnMountOrArgChange: true,
  });

  const [editMode, setEditMode] = useState(false);
  const [newSkill, setNewSkill] = useState({ skillName: "", experience: "" });
  const [isImageSelectModalOpen, setIsImageSelectModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isJobPipelineModalOpen, setIsJobPipelineModalOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [jobPipelineTitleInput, setJobPipelineTitleInput] = useState("");
  const [jobPipelineTitleError, setJobPipelineTitleError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState('');
  const [uniIDFieldError, setUniIDFieldError] = useState('');
  const [certificatesList, setCertificatesList] = useState([]);

  const [profile, setProfile] = useState({
    avatar: user?.avatar || "",
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    portfolio: user?.portfolio || "",
    jobPipelineStatus: user?.jobPipelineStatus || "hidden",
    jobPipelineTitle: user?.jobPipelineTitle || user?.developerProfile?.title || "",
    jobPipelineRejectionReason: user?.jobPipelineRejectionReason || user?.developerProfile?.rejectionReason || "",
    skills: user?.skills || [],
    uniID: user?.uniID || "",
    batch: user?.batch || "",
    section: user?.section || "",
  });

  const fields = ["fullName", "email", "phone", "github", "linkedin", "portfolio", "skills", "uniID", "batch", "section"];
  const completion = Math.round(
    (fields.filter(f => profile[f] && (Array.isArray(profile[f]) ? profile[f].length > 0 : true)).length / fields.length) * 100
  );
  const isJobPipelineRejected = profile.jobPipelineStatus === "rejected";

  useEffect(() => {
    const freshUser = currentUserResponse?.data;

    if (freshUser && isOwnProfile) {
      dispatch(setCredentials({
        user: freshUser,
        token,
      }));
      setProfile({
        avatar: freshUser.avatar || "",
        fullName: freshUser.fullName || "",
        email: freshUser.email || "",
        phone: freshUser.phone || "",
        github: freshUser.github || "",
        linkedin: freshUser.linkedin || "",
        portfolio: freshUser.portfolio || "",
        jobPipelineStatus: freshUser.jobPipelineStatus || "hidden",
        jobPipelineTitle: freshUser.jobPipelineTitle || freshUser.developerProfile?.title || "",
        jobPipelineRejectionReason: freshUser.jobPipelineRejectionReason || freshUser.developerProfile?.rejectionReason || "",
        skills: freshUser.skills || [],
        uniID: freshUser.uniID || "",
        batch: freshUser.batch || "",
        section: freshUser.section || "",
      });
    }
  }, [currentUserResponse, dispatch, isOwnProfile, token]);

  useEffect(() => {
    if (isOwnProfile && user?._id) {
      setCertificatesList([]);
      fetchCertificates({ recipientId: user._id });
    }
  }, [isOwnProfile, user?._id, fetchCertificates]);

  useEffect(() => {
    if (certResponse?.data) {
      const raw = certResponse.data;
      setCertificatesList(Array.isArray(raw) ? raw : raw ? [raw] : []);
    }
  }, [certResponse]);

  useEffect(() => {
    if (isUpdateSuccess || isUpdateError || isImageSuccess || isImageError || isJobPipelineSuccess || isJobPipelineError) {
      const timer = setTimeout(() => {
        resetUpdate();
        resetImage();
        resetJobPipeline();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isUpdateSuccess, isUpdateError, isImageSuccess, isImageError, isJobPipelineSuccess, isJobPipelineError, resetUpdate, resetImage, resetJobPipeline]);

  const handleLogout = () => {
    dispatch(clearCredentials());
    router.push("/");
  };

  const handleUpdate = async () => {
    if (editMode) {
      const trimmedEmail = (profile.email || '').trim().toLowerCase();
      const trimmedUniID = normalizeStudentId(profile.uniID);

      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setEmailFieldError('Please enter a valid email address.');
        return;
      }
      if (detectScientificNotation(profile.uniID)) {
        setUniIDFieldError('University ID cannot be in scientific notation. Please enter the full number.');
        return;
      }
      if (trimmedUniID && !isValidStudentId(trimmedUniID)) {
        setUniIDFieldError('University ID must be digits only (6–20 characters, no symbols or spaces).');
        return;
      }

      try {
        const updatePayload = {
          ...profile,
          email: trimmedEmail,
          uniID: trimmedUniID,
          studentId: trimmedUniID,
        };
        const res = await updateUser({ userData: updatePayload }).unwrap();
        const updatedUser = res?.data?.user || res?.data;
        if (updatedUser) {
          dispatch(setCredentials({
            user: updatedUser,
            token,
          }));
        }
        setEditMode(false);
        setEmailFieldError('');
        setUniIDFieldError('');

        const newUniID = trimmedUniID || user?.uniID || '';
        const oldUniID = user?.uniID || '';
        if (newUniID && newUniID !== oldUniID) {
          router.replace(`/profile/${newUniID}`);
        }
      } catch (error) {
        console.error("Update failed:", error);
        const fieldErrors = error?.data?.errors || [];
        if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
          const emailMsg = fieldErrors.find(e => e.field === 'email');
          const uniMsg = fieldErrors.find(e => e.field === 'uniID');
          if (emailMsg) setEmailFieldError(emailMsg.message);
          if (uniMsg) setUniIDFieldError(uniMsg.message);
        }
      }
    } else {
      setEditMode(true);
      setEmailFieldError('');
      setUniIDFieldError('');
    }
  };

  const validateJobPipelineTitle = (title) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return "Title is required";
    if (trimmedTitle.length < 3) return "Professional title must be at least 3 characters";
    if (trimmedTitle.length > 100) return "Professional title must be 100 characters or fewer";

    return "";
  };

  const getJobPipelineModalTitle = () => {
    if (profile.jobPipelineStatus === "approved") return "Edit Job Pipeline Title";
    if (profile.jobPipelineStatus === "pending") return "Update Job Pipeline Request";
    return "Show in Job Pipeline";
  };

  const openJobPipelineModal = () => {
    setJobPipelineTitleInput(profile.jobPipelineTitle || "");
    setJobPipelineTitleError("");
    setIsJobPipelineModalOpen(true);
  };

  const handleFileSelect = (file) => {
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImageSrc(reader.result);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const uploadCroppedImage = async (croppedFile) => {
    const formData = new FormData();
    formData.append("image", croppedFile);
    try {
      const res = await userImageUpload({ key: "avatar", imageData: formData }).unwrap();
      setProfile(prev => ({ ...prev, avatar: res.data.avatar }));
      setIsCropModalOpen(false);
      setIsImageSelectModalOpen(false);
      setSelectedImageFile(null);
      setSelectedImageSrc("");
    } catch (error) {
      console.error("Upload failed:", error);
      setSelectedImageFile(null);
      setSelectedImageSrc("");
    }
  };

  const handleJobPipelineRequest = async (title) => {
    try {
      const res = await requestJobPipelineProfile({ title }).unwrap();
      const updatedUser = res?.data?.user || res?.data;

      if (updatedUser) {
        dispatch(setCredentials({
          user: updatedUser,
          token,
        }));
        setProfile(prev => ({
          ...prev,
          jobPipelineStatus: updatedUser.jobPipelineStatus || updatedUser.developerProfile?.status || "pending",
          jobPipelineTitle: updatedUser.jobPipelineTitle || updatedUser.developerProfile?.title || title,
          jobPipelineRejectionReason: updatedUser.jobPipelineRejectionReason || updatedUser.developerProfile?.rejectionReason || "",
        }));
      }

      setIsJobPipelineModalOpen(false);
    } catch (error) {
      setJobPipelineTitleError(error?.data?.message || "Failed to submit job pipeline request.");
      console.error("Job pipeline request failed:", error);
    }
  };

  const handleJobPipelineSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = jobPipelineTitleInput.trim();
    const validationError = validateJobPipelineTitle(trimmedTitle);

    if (validationError) {
      setJobPipelineTitleError(validationError);
      return;
    }

    await handleJobPipelineRequest(trimmedTitle);
  };

  const handleJobPipelineRemove = async () => {
    try {
      const res = await removeJobPipelineProfile().unwrap();
      const updatedUser = res?.data?.user || res?.data;

      if (updatedUser) {
        dispatch(setCredentials({
          user: updatedUser,
          token,
        }));
        setProfile(prev => ({
          ...prev,
          jobPipelineStatus: updatedUser.jobPipelineStatus || updatedUser.developerProfile?.status || "hidden",
          jobPipelineTitle: updatedUser.jobPipelineTitle || updatedUser.developerProfile?.title || "",
          jobPipelineRejectionReason: updatedUser.jobPipelineRejectionReason || updatedUser.developerProfile?.rejectionReason || "",
        }));
      }
    } catch (error) {
      console.error("Job pipeline remove failed:", error);
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
        skills: [...prev.skills, { skillName: trimmedSkillName, experience: trimmedExperience }],
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

  const memberProfile = {
    username: user?._id,
    fullName: profile.fullName || user?.fullName || "",
    role: user?.roles?.positionName || "Member",
    department: profile.section || user?.section || "CPCCU",
    batch: profile.batch || user?.batch || "",
    universityId: profile.uniID || user?.uniID || "",
    memberSince: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "",
    joinDate: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "",
    status: getRoleStatus(user?.roles?.role),
    officialRole: user?.roles?.positionName || "Member",
    achievementBadges: deriveAchievementBadges(user),
    isOwner: isOwnProfile,
    photo: profile.avatar || user?.avatar || "",
    bio: profile.bio || user?.bio || "",
    interests: [],
    careerGoals: "",
    email: profile.email || user?.email || "",
    phone: profile.phone || user?.phone || "",
    github: profile.github || user?.github || "",
    linkedin: profile.linkedin || user?.linkedin || "",
    portfolio: profile.portfolio || user?.portfolio || "",
    stats: {
      certificates: certificatesList.length,
      contributions: 0,
      projects: 0,
      events: 0,
      achievements: certificatesList.length,
    },
    skillGroups: mapSkillsToGroups(profile.skills || user?.skills || []),
    certificates: certificatesList.map((cert) => ({
      id: cert.certificateId || cert._id,
      title: cert.contestName || "Certificate",
      issuer: cert.issuedBy || "CPCCU",
      date: cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "",
      verified: true,
      url: `/verify/${cert.certificateId}`,
      achievementBadge: cert.rank ? `🏆 ${cert.rank}` : "🎖 Participant",
    })),
    projects: [],
  };

  return (
    <div className="min-h-screen bg-background">
      <ProfileHero
        member={memberProfile}
        isOwner={isOwnProfile}
        editMode={editMode}
        onEditToggle={() => {
          setEditMode((prev) => !prev);
          setEmailFieldError('');
          setUniIDFieldError('');
        }}
        onJobPipeline={openJobPipelineModal}
        onLogout={handleLogout}
        avatarUrl={profile.avatar || defaultAvatar}
        onImageUploadClick={() => setIsImageSelectModalOpen(true)}
      />

      {!editMode && (
        <div className="mx-auto mt-8 max-w-6xl flex flex-col gap-5 px-4 md:gap-6 md:px-6">
          <QuickStats stats={memberProfile.stats} />

          <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-3">
            <div className="order-1 lg:col-span-2">
              <AboutSection member={memberProfile} />
            </div>
            <div className="order-2">
              <MemberInfoSection member={memberProfile} />
            </div>
            <div className="order-3 lg:order-4">
              <ContactSection member={memberProfile} />
            </div>
            <div className="order-4 lg:order-3 lg:col-span-2">
              <SkillsSection
                skillGroups={memberProfile.skillGroups}
                editMode={false}
                onAddSkill={handleAddSkill}
                onRemoveSkill={handleRemoveSkill}
                newSkill={newSkill}
                setNewSkill={setNewSkill}
              />
            </div>
            {isOwnProfile && (
              <div className="order-5 lg:col-span-3">
                <CertificatesSection certificates={memberProfile.certificates} />
              </div>
            )}
            <div className="order-6 lg:col-span-3">
              <ProjectsSection projects={[]} />
            </div>
          </div>

          {isOwnProfile && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
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
        </div>
      )}

      {editMode && (
        <div className="max-w-5xl mx-auto p-4 md:p-10 bg-background min-h-screen">
          {isJobPipelineRejected && (
            <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-5 py-4 mb-8">
              <h3 className="font-bold text-red-700">Job Pipeline Request Rejected</h3>
              {profile.jobPipelineRejectionReason && (
                <p className="mt-2 text-sm text-red-600">
                  Reason: {profile.jobPipelineRejectionReason}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col gap-8">
              <div className="bg-card p-8 rounded-3xl shadow-sm border border-border flex flex-col items-center text-center">
                <div className="relative group">
                  <div className="w-44 h-44 rounded-full overflow-hidden border-8 border-blue-50 shadow-inner">
                    <Image
                      src={profile.avatar || defaultAvatar}
                      alt="Avatar"
                      width={176}
                      height={176}
                      priority
                      loading="eager"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <button
                    onClick={() => setIsImageSelectModalOpen(true)}
                    className="absolute bottom-2 right-2 bg-blue-600 text-white p-3 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg"
                    aria-label="Change profile photo"
                  >
                    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.36V16.5M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </button>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mt-6">{profile.fullName || "Member Name"}</h2>
                {profile.jobPipelineTitle && (
                  <p className="text-blue-600 font-semibold uppercase text-sm tracking-widest mt-2">{profile.jobPipelineTitle}</p>
                )}
                <p className="text-blue-600 font-semibold uppercase text-sm tracking-widest mt-1">CPCCU Member</p>
              </div>

              <div className="bg-card p-8 rounded-3xl shadow-sm border border-border">
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
                            <svg className="text-blue-600 mt-1 flex-shrink-0 size-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                            <div className="flex-1">
                              <span className="font-semibold text-blue-500">{skill.skillName}: </span>
                              <span className="text-gray-700">{skill.experience}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveSkill(skill)}
                            className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0 mt-1"
                            aria-label="Remove skill"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No skills added yet</p>
                  )}

                  <div className="mt-6 pt-6 border-t border-border flex flex-col gap-3">
                    <input
                      value={newSkill.skillName}
                      onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
                      placeholder="Skill name (e.g., React)"
                      className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
                    />
                    <input
                      value={newSkill.experience}
                      onChange={(e) => setNewSkill({ ...newSkill, experience: e.target.value })}
                      placeholder="Experience (e.g., 2+ years)"
                      className="w-full px-4 py-2 bg-muted border border-border rounded-xl text-sm outline-none focus:border-blue-400 transition-colors"
                    />
                    <button
                      onClick={handleAddSkill}
                      aria-label="Add skill"
                      className="w-full px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors"
                    >
                      + Add Skill
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-card p-8 rounded-3xl shadow-sm border border-border h-full">
                <h3 className="text-xl font-bold text-gray-800 mb-8 pb-4 border-b border-border">Personal & Academic Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-10">
                  {[
                    { label: "Full Name", field: "fullName", placeholder: "Enter full name" },
                    { label: "Email Address", field: "email", placeholder: "email@example.com", isIdentifier: false },
                    { label: "Phone Number", field: "phone", placeholder: "+880 1xxx-xxxxxx" },
                    { label: "University ID", field: "uniID", placeholder: "ID Number", isIdentifier: true },
                    { label: "Batch Number", field: "batch", placeholder: "e.g., 60th" },
                    { label: "Section", field: "section", placeholder: "e.g., A" },
                    { label: "GitHub Profile", field: "github", placeholder: "https://github.com/..." },
                    { label: "LinkedIn Profile", field: "linkedin", placeholder: "https://linkedin.com/in/..." },
                    { label: "Portfolio", field: "portfolio", placeholder: "https://your-portfolio.com" },
                  ].map(({ label, field, placeholder, isIdentifier }) => (
                    <div key={field} className="flex flex-col gap-2">
                      <label className="text-xs font-black uppercase text-gray-400 tracking-widest">{label}</label>
                      {editMode ? (
                        <>
                          <input
                            type={field === "email" ? "email" : "text"}
                            inputMode={isIdentifier ? "numeric" : undefined}
                            value={profile[field]}
                            onChange={(e) => {
                              setProfile({ ...profile, [field]: e.target.value });
                              if (field === 'email') {
                                setEmailFieldError('');
                              }
                              if (field === 'uniID') {
                                setUniIDFieldError('');
                              }
                            }}
                            onBlur={() => {
                              if (field === 'email') {
                                const val = (profile.email || '').trim();
                                if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                                  setEmailFieldError('Please enter a valid email address.');
                                }
                              }
                              if (field === 'uniID') {
                                const val = normalizeStudentId(profile.uniID);
                                if (detectScientificNotation(profile.uniID)) {
                                  setUniIDFieldError('University ID cannot be in scientific notation. Please enter the full number.');
                                }
                                else if (val && !isValidStudentId(val)) {
                                  setUniIDFieldError('University ID must be digits only (6–20 characters, no symbols or spaces).');
                                }
                              }
                            }}
                            placeholder={placeholder}
                            className={`px-4 py-3 bg-muted border rounded-2xl outline-none focus:ring-2 ring-blue-100 focus:border-blue-400 transition-all ${field === 'email' && emailFieldError ? 'border-red-400' : field === 'uniID' && uniIDFieldError ? 'border-red-400' : 'border-border'}`}
                          />
                          {(field === 'email' && emailFieldError) && (
                            <p className="text-xs font-semibold text-red-600">{emailFieldError}</p>
                          )}
                          {(field === 'uniID' && uniIDFieldError) && (
                            <p className="text-xs font-semibold text-red-600">{uniIDFieldError}</p>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-800 font-bold text-lg truncate">
                          {field === "github" || field === "linkedin" || field === "portfolio" ? (
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

          <div className="flex flex-col md:flex-row justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 shadow-lg transition-all disabled:opacity-50"
            >
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {isUpdating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      <Dialog open={isJobPipelineModalOpen} onOpenChange={(open) => {
        setIsJobPipelineModalOpen(open);
        if (!open) setJobPipelineTitleError("");
      }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleJobPipelineSubmit}>
            <DialogHeader>
              <DialogTitle>{getJobPipelineModalTitle()}</DialogTitle>
              <DialogDescription>
                Enter the professional title you want shown after admin approval.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="job-pipeline-title">Professional Title</Label>
                <Input
                  id="job-pipeline-title"
                  value={jobPipelineTitleInput}
                  onChange={(event) => {
                    setJobPipelineTitleInput(event.target.value);
                    setJobPipelineTitleError("");
                  }}
                  placeholder="e.g. Frontend Developer"
                  maxLength={100}
                  aria-invalid={Boolean(jobPipelineTitleError)}
                  className="h-11"
                />
                <div className="text-right text-xs text-muted-foreground">
                  {jobPipelineTitleInput.length}/100
                </div>
                {jobPipelineTitleError && (
                  <p className="text-sm text-destructive">{jobPipelineTitleError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setIsJobPipelineModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRequestingJobPipeline}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {isRequestingJobPipeline ? "Submitting..." : "Submit Request"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImageUploadModal
        isOpen={isImageSelectModalOpen}
        onClose={() => setIsImageSelectModalOpen(false)}
        onFileSelect={handleFileSelect}
        isUploading={isImageUploading}
      />

      {isCropModalOpen && selectedImageSrc && (
        <ProfileImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={selectedImageSrc}
          onCancel={() => {
            setIsCropModalOpen(false);
            setSelectedImageFile(null);
            setSelectedImageSrc("");
          }}
          onCropComplete={uploadCroppedImage}
          isUploading={isImageUploading}
        />
      )}

      {isUpdateSuccess && <SuccessAlert title="Success!" text="Your profile has been updated." />}
      {isImageSuccess && <SuccessAlert title="Success!" text="Profile picture updated." />}
      {isImageError && <ErrorAlert title="Upload Failed" text={uploadError?.data?.message || "Failed to upload image."} />}
      {isJobPipelineError && <ErrorAlert title="Job Pipeline Request Failed" text={jobPipelineError?.data?.message || "Failed to submit job pipeline request."} />}
    </div>
  );
}
