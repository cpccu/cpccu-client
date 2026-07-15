"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import {
  useFetchUsersQuery,
  useRemoveJobPipelineProfileMutation,
  useRequestJobPipelineProfileMutation,
  useUpdateUserMutation,
  useUserImageUploadMutation,
  useGetProjectsQuery,
  useGetPublicProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
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
import { getCertificatesFromResponse } from "@/lib/certificates";

import { ProfileHero } from "@/components/PROFILE/ProfileHero";
import { QuickStats } from "@/components/PROFILE/QuickStats";
import { AboutSection } from "@/components/PROFILE/AboutSection";
import { MemberInfoSection } from "@/components/PROFILE/MemberInfoSection";
import { ContactSection } from "@/components/PROFILE/ContactSection";
import { SkillsSection } from "@/components/PROFILE/SkillsSection";
import { CertificatesSection } from "@/components/PROFILE/CertificatesSection";
import { ProjectsSection } from "@/components/PROFILE/ProjectsSection";
import { ContributionsSection } from "@/components/PROFILE/ContributionsSection";
import { SectionCard } from "@/components/PROFILE/SectionCard";
import { findContributorByGithub, parseContributionInfo } from "@/lib/public-content";
import contributorsData from "@/data/contributors.json";

const defaultAvatar = "/assets/avatar/default-avatar.png";

export function ProfileEditSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-36 bg-navy md:h-44" />
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative -mt-16 overflow-visible rounded-xl border border-border bg-card p-7 md:-mt-14 md:p-9">
          <div className="flex flex-col gap-7 md:flex-row md:items-start md:gap-8">
            <div className="shrink-0">
              <div className="size-32 animate-pulse rounded-xl bg-muted md:size-40" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-5 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="size-28 animate-pulse rounded-xl bg-muted md:size-32" />
          <div className="flex gap-3">
            <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-2">
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-3">
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="lg:col-span-3">
            <div className="h-52 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

// deriveAchievementBadges removed: only official CPCCU roles are shown in ProfileHero, no generic badges

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
    refetchOnFocus: true,
  });

  const [editMode, setEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [newSkill, setNewSkill] = useState({ skillName: "", experience: "" });
  const [editingSkillIndex, setEditingSkillIndex] = useState(null);
  const [editingSkillValues, setEditingSkillValues] = useState({ skillName: "", experience: "" });
  const bioTextareaRef = useRef(null);

  const autoResizeTextarea = useCallback(() => {
    const el = bioTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 240) + 'px';
  }, []);
  const [isImageSelectModalOpen, setIsImageSelectModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isJobPipelineModalOpen, setIsJobPipelineModalOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState("");
  const [jobPipelineTitleInput, setJobPipelineTitleInput] = useState("");
  const [jobPipelineTitleError, setJobPipelineTitleError] = useState("");
  const [emailFieldError, setEmailFieldError] = useState('');
  const [uniIDFieldError, setUniIDFieldError] = useState('');
  const [phoneFieldError, setPhoneFieldError] = useState('');
  const [socialUrlError, setSocialUrlError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadProgressRef = useRef(0);
  const originalProfileRef = useRef(null);
  const [certificatesList, setCertificatesList] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [projectsList, setProjectsList] = useState([]);
  const [newProject, setNewProject] = useState({ title: "", description: "", technologies: "", repoUrl: "", liveUrl: "" });
  const [editingProject, setEditingProject] = useState(null);
  const [createProjectMutation, { isLoading: isCreatingProject }] = useCreateProjectMutation();
  const [updateProjectMutation] = useUpdateProjectMutation();
  const [deleteProjectMutation] = useDeleteProjectMutation();

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
    department: user?.department || "",
    section: user?.section || "",
    bio: user?.bio || "",
  });

  // Snapshot original profile when entering edit mode for dirty detection
  useEffect(() => {
    if (editMode && !originalProfileRef.current) {
      originalProfileRef.current = JSON.parse(JSON.stringify(profile));
    }
    if (!editMode) {
      originalProfileRef.current = null;
    }
  }, [editMode]);

  // Derive isDirty by comparing current profile against original snapshot
  useEffect(() => {
    if (!editMode || !originalProfileRef.current) {
      if (isDirty) setIsDirty(false);
      return;
    }
    const orig = originalProfileRef.current;
    const curr = profile;
    const fields = ['avatar', 'fullName', 'email', 'phone', 'github', 'linkedin', 'portfolio', 'uniID', 'batch', 'department', 'section', 'bio'];
    const hasDiff = fields.some(f => orig[f] !== curr[f]) ||
      JSON.stringify(orig.skills) !== JSON.stringify(curr.skills);
    if (hasDiff !== isDirty) {
      setIsDirty(hasDiff);
    }
  }, [profile, editMode]);

  // Browser unsaved changes warning
  useEffect(() => {
    if (!editMode || !isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editMode, isDirty]);

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
        department: freshUser.department || "",
        section: freshUser.section || "",
        bio: freshUser.bio || "",
      });
    }
  }  , [currentUserResponse, dispatch, isOwnProfile, token]);

  const { data: projectsResponse } = useGetProjectsQuery(undefined, {
    skip: !isOwnProfile || !token,
  });

  const { data: publicProjectsResponse } = useGetPublicProjectsQuery(user?._id, {
    skip: isOwnProfile || !user?._id,
  });

  useEffect(() => {
    if (isOwnProfile && projectsResponse?.data) {
      setProjectsList(projectsResponse.data);
    } else if (!isOwnProfile && publicProjectsResponse?.data) {
      setProjectsList(publicProjectsResponse.data);
    }
  }, [projectsResponse, publicProjectsResponse, isOwnProfile]);

  useEffect(() => {
    if (editMode) {
      setTimeout(autoResizeTextarea, 50);
    }
  }, [editMode, autoResizeTextarea]);

  useEffect(() => {
    const studentId = user?.uniID;
    if (!studentId) return;
    setCertificatesList([]);
    setCertificatesLoading(true);
    fetchCertificates({ recipientId: studentId }).finally(() =>
      setCertificatesLoading(false),
    );
  }, [user?.uniID, fetchCertificates]);

  useEffect(() => {
    if (certResponse?.data) {
      setCertificatesLoading(false);
      setCertificatesList(getCertificatesFromResponse(certResponse));
    }
  }, [certResponse]);

  useEffect(() => {
    if (certResponse?.data) {
      setCertificatesLoading(false);
      setCertificatesList(getCertificatesFromResponse(certResponse));
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

      // Phone validation
      const trimmedPhone = (profile.phone || '').trim();
      if (trimmedPhone && !/^[+]?[\d\s\-().]{7,20}$/.test(trimmedPhone)) {
        setPhoneFieldError('Please enter a valid phone number (7–20 digits, optional + prefix).');
        return;
      }

      // Normalize social URLs with platform validation
      const normalizeUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        return `https://${trimmed}`;
      };

      const normalizedGithub = normalizeUrl(profile.github);
      const normalizedLinkedin = normalizeUrl(profile.linkedin);
      const normalizedPortfolio = normalizeUrl(profile.portfolio);

      // Validate social URLs — warn with visible feedback
      setSocialUrlError('');
      if (normalizedGithub && !/^https?:\/\/([a-z0-9-]+\.)*github\./i.test(normalizedGithub)) {
        setSocialUrlError('GitHub URL must point to github.com or a GitHub Enterprise instance.');
        return;
      }
      if (normalizedLinkedin && !/^https?:\/\/([a-z0-9-]+\.)*linkedin\./i.test(normalizedLinkedin)) {
        setSocialUrlError('LinkedIn URL must point to linkedin.com or a LinkedIn subdomain.');
        return;
      }
      if (normalizedPortfolio && !/^https?:\/\//i.test(normalizedPortfolio)) {
        setSocialUrlError('Portfolio URL must be a valid URL (starting with http:// or https://).');
        return;
      }

      try {
        const updatePayload = {
          ...profile,
          email: trimmedEmail,
          uniID: trimmedUniID,
          studentId: trimmedUniID,
          github: normalizedGithub,
          linkedin: normalizedLinkedin,
          portfolio: normalizedPortfolio,
        };
        const res = await updateUser({ userData: updatePayload }).unwrap();
        const updatedUser = res?.data?.user || res?.data;
        if (updatedUser) {
          dispatch(setCredentials({
            user: updatedUser,
            token,
          }));
        }
      originalProfileRef.current = JSON.parse(JSON.stringify(profile));
      setEditMode(false);
      setIsDirty(false);
      setEmailFieldError('');
      setUniIDFieldError('');
      setPhoneFieldError('');

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
      setPhoneFieldError('');
      setSocialUrlError('');
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setIsDirty(false);
    setEmailFieldError('');
    setUniIDFieldError('');
    setPhoneFieldError('');
    setSocialUrlError('');
    setNewProject({ title: "", description: "", technologies: "", repoUrl: "", liveUrl: "" });
    setEditingProject(null);
    // Reset profile to original user data
    setProfile({
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
      department: user?.department || "",
      section: user?.section || "",
      bio: user?.bio || "",
    });
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
    uploadProgressRef.current = 0;
    setUploadProgress(0);
    // Animate progress to ~80% while uploading (RTK Query doesn't expose real progress)
    const progressInterval = setInterval(() => {
      uploadProgressRef.current = Math.min(uploadProgressRef.current + 8, 80);
      setUploadProgress(uploadProgressRef.current);
    }, 400);
    try {
      const res = await userImageUpload({ key: "avatar", imageData: formData }).unwrap();
      clearInterval(progressInterval);
      setUploadProgress(100);
      // Append cache-busting timestamp to avatar URL
      const avatarUrl = `${res.data.avatar}?v=${Date.now()}`;
      setProfile(prev => {
        // Also sync the original snapshot so avatar upload doesn't trigger false dirty state
        if (originalProfileRef.current) {
          originalProfileRef.current.avatar = avatarUrl;
        }
        return { ...prev, avatar: avatarUrl };
      });
      setTimeout(() => setUploadProgress(0), 600);
      setIsCropModalOpen(false);
      setIsImageSelectModalOpen(false);
      setSelectedImageFile(null);
      setSelectedImageSrc("");
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
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

  const handleFieldChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (field === 'email') setEmailFieldError('');
    if (field === 'uniID') setUniIDFieldError('');
    if (field === 'phone') setPhoneFieldError('');
    if (['github', 'linkedin', 'portfolio'].includes(field)) setSocialUrlError('');
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

  const handleStartEditSkill = (index) => {
    setEditingSkillIndex(index);
    setEditingSkillValues({
      skillName: profile.skills[index].skillName,
      experience: profile.skills[index].experience,
    });
  };

  const handleSaveEditedSkill = () => {
    if (editingSkillIndex === null) return;
    const trimmedName = editingSkillValues.skillName.trim();
    const trimmedExp = editingSkillValues.experience.trim();
    if (!trimmedName || !trimmedExp) return;

    setProfile((prev) => {
      const newSkills = [...prev.skills];
      newSkills[editingSkillIndex] = {
        skillName: trimmedName,
        experience: trimmedExp,
      };
      return { ...prev, skills: newSkills };
    });
    setEditingSkillIndex(null);
    setEditingSkillValues({ skillName: "", experience: "" });
  };

  const handleCancelEditSkill = () => {
    setEditingSkillIndex(null);
    setEditingSkillValues({ skillName: "", experience: "" });
  };

  const handleAddProject = async () => {
    if (!newProject.title.trim()) return;
    try {
      const res = await createProjectMutation({
        title: newProject.title.trim(),
        description: newProject.description.trim(),
        technologies: newProject.technologies.split(',').map(t => t.trim()).filter(Boolean),
        repoUrl: newProject.repoUrl.trim(),
        liveUrl: newProject.liveUrl.trim(),
      }).unwrap();
      if (res?.data) {
        setProjectsList(prev => [...prev, res.data]);
      }
      setNewProject({ title: "", description: "", technologies: "", repoUrl: "", liveUrl: "" });
    } catch (error) {
      console.error("Create project failed:", error);
    }
  };

  const handleUpdateProject = async (id, data) => {
    try {
      const payload = {
        ...data,
        technologies: typeof data.technologies === 'string'
          ? data.technologies.split(',').map(t => t.trim()).filter(Boolean)
          : data.technologies,
      };
      const res = await updateProjectMutation({ id, ...payload }).unwrap();
      if (res?.data) {
        setProjectsList(prev => prev.map(p => (p._id === id || p.id === id) ? res.data : p));
      }
      setEditingProject(null);
    } catch (error) {
      console.error("Update project failed:", error);
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await deleteProjectMutation(id).unwrap();
      setProjectsList(prev => prev.filter(p => p._id !== id && p.id !== id));
    } catch (error) {
      console.error("Delete project failed:", error);
    }
  };

  const memberProjects = useMemo(() =>
    projectsList.map((p) => ({
      id: p._id || p.id,
      name: p.title,
      description: p.description,
      technologies: Array.isArray(p.technologies) ? p.technologies : [],
      repoUrl: p.repoUrl,
      liveUrl: p.liveUrl,
    })),
    [projectsList]
  );

  // Resolve GitHub contribution data for QuickStats and the ContributionsSection
  const contributorMatch = useMemo(() => {
    const githubUrl = profile.github || user?.github || '';
    if (!githubUrl) return null;
    const contributor = findContributorByGithub(githubUrl, contributorsData);
    return contributor ? parseContributionInfo(contributor) : null;
  }, [profile.github, user?.github]);

  const memberProfile = useMemo(() => ({
    username: user?._id,
    fullName: profile.fullName || user?.fullName || "",
    role: user?.roles?.positionName || "Member",
    department: profile.department || user?.department || "",
    section: profile.section || user?.section || "",
    batch: profile.batch || user?.batch || "",
    universityId: profile.uniID || user?.uniID || "",
    memberSince: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "",
    joinDate: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : "",
    officialRole: user?.roles?.positionName || "Member",
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
      contributions: contributorMatch ? contributorMatch.commitCount : '—',
      projects: projectsList.length,
      events: 0,
    },
    skillGroups: mapSkillsToGroups(profile.skills || user?.skills || []),
    certificates: certificatesList.map((cert) => ({
      id: cert.certificateId || cert._id,
      title: cert.contestName || "Certificate",
      issuer: cert.issuedBy || "CPCCU",
      date: cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "",
      certificateId: cert.certificateId || "",
      verified: true,
      url: `/certificate/${cert.certificateId}`,
      certificateType: cert.certificateType || "participation",
      achievementBadge: cert.certificateType
        ? ({ winner: '1st Place', 'runner-up': '2nd Place', '2nd-runner-up': '3rd Place', participation: 'Participant' }[cert.certificateType] || 'Certified')
        : 'Certified',
    })),
    projects: memberProjects,
  }), [profile, user, certificatesList, projectsList, isOwnProfile, contributorMatch]);

  const skillLevels = [
    { value: "Expert", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    { value: "Intermediate", color: "bg-blue-100 text-blue-800 border-blue-200" },
    { value: "Learning", color: "bg-amber-100 text-amber-800 border-amber-200" },
  ];

  const getSkillLevelColor = (level) => {
    const found = skillLevels.find(s => s.value === level);
    return found?.color || "bg-gray-100 text-gray-700 border-gray-200";
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
          setPhoneFieldError('');
          setSocialUrlError('');
        }}
        jobPipelineStatus={profile.jobPipelineStatus}
        onJobPipelineOpen={openJobPipelineModal}
        onJobPipelineRemove={handleJobPipelineRemove}
        isRequestingJobPipeline={isRequestingJobPipeline}
        isRemovingJobPipeline={isRemovingJobPipeline}
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
            <div className="order-5 lg:col-span-3">
              <CertificatesSection
                certificates={memberProfile.certificates}
                isLoading={certificatesLoading && certificatesList.length === 0}
                isOwner={isOwnProfile}
              />
            </div>
            <div className="order-6 lg:col-span-3">
              <ProjectsSection projects={memberProjects} />
            </div>
            <div className="order-7 lg:col-span-3">
              <ContributionsSection githubUrl={memberProfile.github} />
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
        <div className="mx-auto mt-8 max-w-6xl flex flex-col gap-5 px-4 md:gap-6 md:px-6 pb-28">
          <QuickStats stats={memberProfile.stats} />
          {/* Job Pipeline Rejection Warning */}
          {isJobPipelineRejected && (
            <div className="w-full rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <h3 className="font-bold text-red-700">Job Pipeline Request Rejected</h3>
              {profile.jobPipelineRejectionReason && (
                <p className="mt-2 text-sm text-red-600">
                  Reason: {profile.jobPipelineRejectionReason}
                </p>
              )}
            </div>
          )}

          {/* Avatar & Photo Controls */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <Image
                src={profile.avatar || defaultAvatar}
                alt="Profile photo"
                width={120}
                height={120}
                priority
                className="size-28 rounded-xl border-4 border-card bg-white object-contain object-center shadow-md md:size-32"
              />
              <button
                onClick={() => setIsImageSelectModalOpen(true)}
                disabled={isImageUploading}
                className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Change profile photo"
              >
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.36V16.5M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              </button>
            </div>
            {/* Upload Progress Bar */}
            {uploadProgress > 0 && (
              <div className="w-full max-w-xs">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {uploadProgress < 100 ? "Uploading..." : "Processing..."}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-muted-foreground">{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsImageSelectModalOpen(true)}
                disabled={isImageUploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.36V16.5M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                {isImageUploading ? "Uploading..." : "Upload Photo"}
              </button>
              {profile.avatar && !isImageUploading && (
                <button
                  type="button"
                  onClick={() => handleFieldChange('avatar', '')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-card px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50"
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-3">
            {/* Personal Information - Edit */}
            <div className="order-2 lg:col-span-2">
              <SectionCard title="Personal Information" icon={null}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  {[
                    { label: "Full Name", field: "fullName", type: "text", placeholder: "Enter your full name" },
                    { label: "Email Address", field: "email", type: "email", placeholder: "email@example.com", validation: emailFieldError },
                    { label: "University ID", field: "uniID", type: "text", placeholder: "ID Number", validation: uniIDFieldError, inputMode: "numeric" },
                    { label: "Phone Number", field: "phone", type: "tel", placeholder: "+880 1xxx-xxxxxx", validation: phoneFieldError },
                    { label: "Batch", field: "batch", type: "text", placeholder: "e.g., 60th" },
                    { label: "Department", field: "department", type: "text", placeholder: "e.g., Computer Science & Engineering" },
                    { label: "Section", field: "section", type: "text", placeholder: "e.g., A" },
                  ].map(({ label, field, type, placeholder, validation, inputMode }) => (
                    <div key={field} className="group relative">
                      <input
                        id={`edit-${field}`}
                        type={type}
                        inputMode={inputMode}
                        value={profile[field] || ''}
                        onChange={(e) => {
                          handleFieldChange(field, e.target.value);
                        }}
                        onBlur={() => {
                          if (field === 'email') {
                            const val = (profile.email || '').trim();
                            if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                              setEmailFieldError('Please enter a valid email address.');
                            }
                          }
                          if (field === 'phone') {
                            const val = (profile.phone || '').trim();
                            if (val && !/^[+]?[\d\s\-().]{7,20}$/.test(val)) {
                              setPhoneFieldError('Please enter a valid phone number (7–20 digits).');
                            }
                          }
                          if (field === 'uniID') {
                            const val = normalizeStudentId(profile.uniID);
                            if (detectScientificNotation(profile.uniID)) {
                              setUniIDFieldError('University ID cannot be in scientific notation. Please enter the full number.');
                            } else if (val && !isValidStudentId(val)) {
                              setUniIDFieldError('University ID must be digits only (6–20 characters, no symbols or spaces).');
                            }
                          }
                        }}
                        placeholder={placeholder}
                        aria-label={label}
                        aria-invalid={validation ? 'true' : undefined}
                        aria-describedby={validation ? `${field}-error` : undefined}
                        className={`peer w-full rounded-lg border bg-card px-3.5 py-3 text-sm text-foreground outline-none transition-all placeholder:text-transparent focus:border-primary/60 focus:ring-2 focus:ring-primary/10 ${validation ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-border hover:border-muted-foreground/30'}`}
                      />
                      <label
                        htmlFor={`edit-${field}`}
                        className={`pointer-events-none absolute left-3.5 top-3 origin-left text-sm transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-7 peer-focus:scale-[0.85] ${validation ? 'text-red-500' : 'text-muted-foreground'} ${profile[field] ? '-translate-y-7 scale-[0.85]' : ''}`}
                      >
                        {label}
                      </label>
                      {validation && (
                        <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-red-500" role="alert">
                          {validation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* Social Links - Edit */}
            <div className="order-3 lg:order-4">
              <SectionCard title="Contact & Social" icon={null}>
                {socialUrlError && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-amber-800" role="alert">{socialUrlError}</p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {[
                    { field: "github", label: "GitHub", icon: "M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.02 11.02 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.05.78 2.12 0 1.54-.02 2.78-.02 3.16 0 .31.21.67.8.55A11.51 11.51 0 0023.5 12C23.5 5.65 18.35.5 12 .5Z", placeholder: "https://github.com/username" },
                    { field: "linkedin", label: "LinkedIn", icon: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 111 0-4.12 2.06 2.06 0 010 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z", placeholder: "https://linkedin.com/in/username" },
                    { field: "portfolio", label: "Portfolio", icon: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418", placeholder: "https://your-portfolio.com" },
                  ].map(({ field, label, icon, placeholder }) => (
                    <div key={field} className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        >
                          <path d={icon} />
                        </svg>
                      </div>
                      <input
                        id={`edit-${field}`}
                        type="url"
                        value={profile[field] || ''}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                        placeholder={placeholder}
                        aria-label={label}
                        className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      />
                      <label
                        htmlFor={`edit-${field}`}
                        className="absolute -top-2 left-3 bg-card px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            {/* About - Edit */}
            <div className="order-1 lg:col-span-2">
              <SectionCard title="About" icon={null}>
                <div className="flex flex-col gap-6">
                  {/* Bio Section */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="edit-bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Bio
                      </label>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {(profile.bio || '').length}/300
                      </span>
                    </div>
                    <textarea
                      id="edit-bio"
                      ref={bioTextareaRef}
                      value={profile.bio || ''}
                      onChange={(e) => {
                        if (e.target.value.length <= 300) {
                          handleFieldChange('bio', e.target.value);
                          setTimeout(autoResizeTextarea, 0);
                        }
                      }}
                      onInput={autoResizeTextarea}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      aria-label="Bio"
                      className="w-full resize-none overflow-hidden rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 hover:border-muted-foreground/30 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      style={{ minHeight: '80px' }}
                    />
                    {profile.bio && (
                      <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{profile.bio}</p>
                      </div>
                    )}
                  </div>

                  {/* Career Goals (Coming Soon) */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="edit-career-goals" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Career Goals <span className="font-normal normal-case text-muted-foreground/60">(coming soon)</span>
                      </label>
                    </div>
                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
                      <p className="text-sm text-muted-foreground">Career goal tracking will be available in a future update.</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Skills - Edit */}
            <div className="order-4 lg:order-3 lg:col-span-2">
              <SectionCard title="Skills" icon={null}>
                <div className="flex flex-col gap-4">
                  {profile.skills && profile.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, index) => {
                        const levelColor = getSkillLevelColor(skill.experience);
                        const isEditing = editingSkillIndex === index;
                        return isEditing ? (
                          <div key={`${skill.skillName}-${index}`} className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
                            <input
                              value={editingSkillValues.skillName}
                              onChange={(e) => setEditingSkillValues(prev => ({ ...prev, skillName: e.target.value }))}
                              placeholder="Skill name"
                              aria-label="Edit skill name"
                              className="flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditedSkill(); if (e.key === 'Escape') handleCancelEditSkill(); }}
                            />
                            <select
                              value={editingSkillValues.experience}
                              onChange={(e) => setEditingSkillValues(prev => ({ ...prev, experience: e.target.value }))}
                              aria-label="Edit skill level"
                              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                            >
                              <option value="Expert">Expert</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Learning">Learning</option>
                            </select>
                            <button
                              onClick={handleSaveEditedSkill}
                              className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              aria-label="Save skill edit"
                            >
                              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelEditSkill}
                              className="inline-flex size-6 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
                              aria-label="Cancel skill edit"
                            >
                              <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span
                            key={`${skill.skillName}-${index}`}
                            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:border-primary/40 hover:bg-accent"
                            onClick={() => handleStartEditSkill(index)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleStartEditSkill(index); }}
                            aria-label={`Edit ${skill.skillName} (${skill.experience})`}
                          >
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${levelColor}`}>
                              {skill.experience}
                            </span>
                            <span>{skill.skillName}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveSkill(skill); }}
                              className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                              aria-label={`Remove ${skill.skillName}`}
                            >
                              <svg className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No skills added yet. Add your first skill below.</p>
                  )}

                  <div className="mt-2 flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add New Skill</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={newSkill.skillName}
                        onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
                        placeholder="Skill name (e.g., React)"
                        aria-label="New skill name"
                        className="flex-1 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      />
                      <select
                        value={newSkill.experience}
                        onChange={(e) => setNewSkill({ ...newSkill, experience: e.target.value })}
                        aria-label="Skill proficiency level"
                        className="rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      >
                        <option value="" disabled>Proficiency</option>
                        <option value="Expert">Expert</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Learning">Learning</option>
                      </select>
                      <button
                        onClick={handleAddSkill}
                        disabled={!newSkill.skillName.trim() || !newSkill.experience}
                        aria-label="Add skill"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Interests - Edit (Coming Soon) */}
            <div className="order-5 lg:col-span-2">
              <SectionCard title="Interests" icon={null}>
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center">
                    <p className="text-sm font-semibold text-muted-foreground">Interest management coming soon</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">You'll be able to add and manage your interests here.</p>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Certificates - Read-only */}
            <div className="order-6 lg:col-span-3">
              <CertificatesSection
                certificates={memberProfile.certificates}
                isLoading={certificatesLoading && certificatesList.length === 0}
                isOwner={isOwnProfile}
              />
            </div>

            {/* Projects - Edit */}
            <div className="order-7 lg:col-span-3">
              <SectionCard title="Projects" icon={null}>
                <div className="flex flex-col gap-4">
                  {projectsList.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {projectsList.map((project) => {
                        const isEditing = editingProject?._id === project._id || editingProject?.id === project.id;
                        const techs = Array.isArray(project.technologies) ? project.technologies : [];
                        return isEditing && editingProject ? (
                          <div key={project._id || project.id} className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
                            <input
                              value={editingProject.title}
                              onChange={(e) => setEditingProject(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Project title"
                              aria-label="Edit project title"
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-bold outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 mb-2"
                              autoFocus
                            />
                            <textarea
                              value={editingProject.description}
                              onChange={(e) => setEditingProject(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Description"
                              aria-label="Edit description"
                              rows={2}
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 mb-2 resize-none"
                            />
                            <input
                              value={editingProject.technologies}
                              onChange={(e) => setEditingProject(prev => ({ ...prev, technologies: e.target.value }))}
                              placeholder="Technologies (comma-separated)"
                              aria-label="Edit technologies"
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 mb-2"
                            />
                            <input
                              value={editingProject.repoUrl}
                              onChange={(e) => setEditingProject(prev => ({ ...prev, repoUrl: e.target.value }))}
                              placeholder="GitHub URL"
                              aria-label="Edit repo URL"
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 mb-2"
                            />
                            <input
                              value={editingProject.liveUrl}
                              onChange={(e) => setEditingProject(prev => ({ ...prev, liveUrl: e.target.value }))}
                              placeholder="Live demo URL"
                              aria-label="Edit live URL"
                              className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 mb-3"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateProject(project._id || project.id, editingProject)}
                                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProject(null)}
                                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={project._id || project.id}
                            className="group relative rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                          >
                            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => setEditingProject({ ...project, technologies: Array.isArray(project.technologies) ? project.technologies.join(', ') : '' })}
                                className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                                aria-label="Edit project"
                              >
                                <svg className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                              </button>
                              <button
                                onClick={() => handleDeleteProject(project._id || project.id)}
                                className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-accent-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
                                aria-label="Delete project"
                              >
                                <svg className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            </div>
                            <h3 className="text-sm font-bold text-foreground pr-12">{project.title}</h3>
                            {project.description && (
                              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">{project.description}</p>
                            )}
                            {techs.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {techs.map((tech) => (
                                  <span key={tech} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tech}</span>
                                ))}
                              </div>
                            )}
                            {(project.repoUrl || project.liveUrl) && (
                              <div className="mt-3 flex gap-2">
                                {project.repoUrl && (
                                  <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline">Repository</a>
                                )}
                                {project.liveUrl && (
                                  <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline">Live Demo</a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No projects yet. Add your first project below.</p>
                  )}

                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add New Project</p>
                    <div className="flex flex-col gap-2">
                      <input
                        value={newProject.title}
                        onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Project title *"
                        aria-label="New project title"
                        className="w-full rounded-lg border border-border bg-card px-3.5 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      />
                      <textarea
                        value={newProject.description}
                        onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Description"
                        aria-label="Project description"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-card px-3.5 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={newProject.technologies}
                          onChange={(e) => setNewProject(prev => ({ ...prev, technologies: e.target.value }))}
                          placeholder="Technologies (comma-separated)"
                          aria-label="Project technologies"
                          className="flex-1 rounded-lg border border-border bg-card px-3.5 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                        />
                        <input
                          value={newProject.repoUrl}
                          onChange={(e) => setNewProject(prev => ({ ...prev, repoUrl: e.target.value }))}
                          placeholder="GitHub URL"
                          aria-label="Project repo URL"
                          className="flex-1 rounded-lg border border-border bg-card px-3.5 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                        />
                        <input
                          value={newProject.liveUrl}
                          onChange={(e) => setNewProject(prev => ({ ...prev, liveUrl: e.target.value }))}
                          placeholder="Live demo URL"
                          aria-label="Project live URL"
                          className="flex-1 rounded-lg border border-border bg-card px-3.5 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <button
                        onClick={handleAddProject}
                        disabled={!newProject.title.trim() || isCreatingProject}
                        className="self-start inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        {isCreatingProject ? "Adding..." : "Add Project"}
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Privacy - Hidden Ready */}
            {false && (
              <div className="order-8 lg:col-span-3">
                <SectionCard title="Privacy" icon={null}>
                  <p className="text-sm text-muted-foreground">Privacy settings will be available here.</p>
                </SectionCard>
              </div>
            )}

            {/* Profile Completion */}
            <div className="order-9 lg:col-span-3">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-foreground">Profile Completion</span>
                  <span className="text-lg font-black text-primary">{completion}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 ease-out"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Sticky Bar */}
      {editMode && isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="border-t border-border bg-white/95 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-2 rounded-full bg-amber-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">You have unsaved changes</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUpdating ? (
                    <>
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
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
