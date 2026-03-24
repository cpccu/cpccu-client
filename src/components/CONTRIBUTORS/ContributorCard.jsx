"use client";

import { FaGithub, FaLinkedin, FaCode } from "react-icons/fa";
import Link from "next/link";

export default function ContributorCard({ contributor }) {
  return (
    <div className="group bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 hover:border-header/30 transition-all duration-500 overflow-hidden flex flex-col">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-header to-blue-400" />

      <div className="p-6 flex flex-col items-center gap-4 flex-1">
        {/* Avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-header/20 group-hover:ring-header/50 transition-all duration-500">
            <img
              src={contributor?.avatar}
              alt={contributor?.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor?.name)}&background=3b60c9&color=fff&size=128`;
              }}
            />
          </div>
          {/* Online indicator */}
          <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
        </div>

        {/* Info */}
        <div className="text-center flex flex-col gap-1">
          <h3 className="text-lg font-bold text-gray-900 group-hover:text-header transition-colors duration-300">
            {contributor?.name}
          </h3>
          <span className="inline-block bg-header/10 text-header text-xs font-semibold px-3 py-1 rounded-full">
            {contributor?.role}
          </span>
        </div>

        {/* Department & Batch */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>Batch {contributor?.batch}</span>
        </div>

        {/* Contribution */}
        <p className="text-sm text-gray-600 text-center leading-relaxed border-t border-gray-100 pt-3 w-full">
          {contributor?.contribution}
        </p>

        {/* Social Links */}
        <div className="flex items-center gap-3 mt-auto pt-2">
          {contributor?.github && (
            <Link
              href={contributor.github}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-600 transition-all duration-300"
            >
              <FaGithub size={16} />
            </Link>
          )}
          {contributor?.linkedin && (
            <Link
              href={contributor.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition-all duration-300"
            >
              <FaLinkedin size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
