"use client";

import { useState } from "react";
import AboutCard from "@/components/ABOUT/AboutCard";
import PreviousCommitteeData from "@/data/PreviousCommittee.json";
import { FaChevronDown } from "react-icons/fa";

export default function PreviousCommittee() {
  const [expandedYear, setExpandedYear] = useState(null);

  const toggleYear = (year) => {
    setExpandedYear(expandedYear === year ? null : year);
  };

  return (
    <main className="bg-white py-16 md:py-20">
      {/* Header Section */}
      <section className="padding mb-12">
        <div className="text-center mb-8">
          <p className="text-header font-mono text-sm font-semibold mb-2 tracking-wide uppercase">
            // our legacy
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
            Previous Committees
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Meet the dedicated leaders who have guided CPCCU through the years. 
            Their contributions have shaped the foundation of our community.
          </p>
        </div>
      </section>

      {/* Timeline Accordion */}
      <section className="padding">
        <div className="max-w-4xl mx-auto space-y-4">
          {PreviousCommitteeData.map((yearData, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-xl overflow-hidden hover:border-header/50 transition-all duration-300"
            >
              {/* Year Header */}
              <button
                onClick={() => toggleYear(yearData.year)}
                className="w-full bg-gradient-to-r from-header/5 to-blue-50 hover:from-header/10 hover:to-blue-100 px-6 py-4 flex items-center justify-between transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-header/20 flex items-center justify-center">
                    <span className="text-header font-bold text-sm">{yearData.year.split("-")[0]}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-gray-900">{yearData.year}</p>
                    <p className="text-sm text-gray-500">{yearData.members.length} members</p>
                  </div>
                </div>
                <FaChevronDown
                  className={`text-header transition-transform duration-300 ${
                    expandedYear === yearData.year ? "rotate-180" : ""
                  }`}
                  size={18}
                />
              </button>

              {/* Members Grid - Expandable */}
              {expandedYear === yearData.year && (
                <div className="bg-gray-50 px-6 py-8 border-t border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {yearData.members.map((member, memberIndex) => (
                      <div
                        key={memberIndex}
                        className="bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-100 hover:border-header/30 transition-all duration-300 overflow-hidden group"
                      >
                        {/* Top accent bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-header to-blue-400" />

                        <div className="p-4 flex flex-col items-center gap-3 text-center">
                          {/* Avatar */}
                          <div className="w-16 h-16 rounded-full overflow-hidden ring-3 ring-header/10 group-hover:ring-header/40 transition-all duration-300">
                            <img
                              src={member?.avatar}
                              alt={member?.fullName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  member?.fullName
                                )}&background=3b60c9&color=fff&size=128`;
                              }}
                            />
                          </div>

                          {/* Info */}
                          <div>
                            <h3 className="font-bold text-gray-900 text-sm capitalize group-hover:text-header transition-colors duration-300">
                              {member?.fullName}
                            </h3>
                            <span className="inline-block mt-1 bg-header/10 text-header text-xs font-semibold px-2 py-0.5 rounded-full">
                              {member?.position}
                            </span>
                          </div>

                          {/* Email */}
                          <a
                            href={`mailto:${member?.email}`}
                            className="text-xs text-header hover:text-header/80 transition-colors duration-300 truncate w-full"
                            title={member?.email}
                          >
                            {member?.email}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Legacy Section */}
      <section className="padding mt-16 bg-gradient-to-r from-header/5 to-blue-50 rounded-2xl py-12 text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-3">
          A Legacy of Leadership
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Each committee has contributed to building a stronger CPCCU community. 
          Their dedication, innovation, and hard work continue to inspire the current 
          and future leaders of our organization.
        </p>
      </section>
    </main>
  );
}
