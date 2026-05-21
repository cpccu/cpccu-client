import Button from "@/components/GlobalComponents/Button";

import { useSelector } from "react-redux";

export default function ProfileID({ user, isOwnProfile }) {
  const defaultAvatar = "/assets/avatar/default-avatar.png";
  
  return (
    <main className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 h-44 lg:h-60 relative">
        {user?.coverImage && (
          <img src={user.coverImage} alt="cover" className="w-full h-full object-cover opacity-60" />
        )}
      </div>

      <div className="flex flex-col gap-6 items-center justify-center relative -top-16 px-3 lg:px-16 lg:flex-row lg:justify-start lg:items-end">
        <div className="h-36 w-36 lg:h-44 lg:w-44 shrink-0 rounded-full bg-white p-1 shadow-xl">
          <img 
            src={user?.avatar || defaultAvatar} 
            alt="profile" 
            className="w-full h-full object-cover rounded-full border-4 border-white"
          />
        </div>
        <div className="text-center lg:text-left pb-4">
          <h1 className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tight">
            {user?.fullName || "Member Name"}
          </h1>
          <p className="text-blue-600 font-bold uppercase tracking-widest text-sm mt-1">
            {user?.roles?.positionName || "CPCCU Member"}
          </p>
        </div>

        {isOwnProfile && (
          <div className="lg:ml-auto pb-6">
            <Button title={"Edit Profile"} />
          </div>
        )}
      </div>
    </main>
  );
}
