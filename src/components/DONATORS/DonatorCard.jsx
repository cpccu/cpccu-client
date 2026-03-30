"use client";

import { FaGlobe, FaLinkedin } from "react-icons/fa";

export default function DonatorCard({ donator }) {
  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-100 hover:border-header/40 transition-all duration-300 overflow-hidden group h-full">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-header to-blue-400" />

      <div className="p-6 flex flex-col gap-4">
        {/* Avatar & Basic Info */}
        <div className="flex items-center justify-center flex-col gap-4">
          <div className="w-40 h-40 rounded-full overflow-hidden ring-3 ring-header/10 group-hover:ring-header/40 transition-all duration-300 flex-shrink-0">
            <img
              src={donator?.avatar}
              alt={donator?.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  donator?.name
                )}&background=3b60c9&color=fff&size=128`;
              }}
            />
          </div>
          <div className="flex-1 min-w-0 text-center">
            <h3 className="font-bold text-gray-900 text-xl capitalize group-hover:text-header transition-colors duration-300 truncate">
              {donator?.name}
            </h3>
            <p className="text-xs text-gray-500 truncate">{donator?.company}</p>
            <span className="inline-block mt-1 bg-header/10 text-header text-xs font-semibold px-2 py-0.5 rounded-full">
              {donator?.designation} {donator?.batch && `- Batch ${donator?.batch}`}
            </span>
          </div>
        </div>

        {/* Contribution */}
        {/* <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-header">Contribution:</span> {donator?.contribution}
          </p>
        </div> */}

        {/* Social Links */}
        <div className="flex items-center gap-2 pt-2 justify-center">
          {donator?.website && (
            <a
              href={donator.website}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-header hover:text-white text-gray-600 transition-all duration-300"
              title="Visit Website"
            >
              <FaGlobe size={13} />
            </a>
          )}
          {donator?.linkedin && (
            <a
              href={donator.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-600 transition-all duration-300"
              title="LinkedIn Profile"
            >
              <FaLinkedin size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
