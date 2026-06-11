"use client";

import { useState } from "react";
import PreviousCommitteeData from "@/data/PreviousCommittee.json";
import { FaChevronDown } from "react-icons/fa";

export default function PreviousCommittee({ data = PreviousCommitteeData }) {
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
        <div className="max-w-7xl mx-auto space-y-6">
          {data.map((yearData, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-2xl overflow-hidden hover:border-header/50 transition-all duration-300 shadow-sm"
            >
              {/* Year Header */}
              <button
                onClick={() => toggleYear(yearData.year)}
                className="w-full bg-gradient-to-r from-header/5 to-blue-50 hover:from-header/10 hover:to-blue-100 px-8 py-6 flex items-center justify-between transition-all duration-300"
              >
                <div className="flex items-center gap-6">
                  <div className="w-30 h-25 rounded-2xl bg-header/20 flex items-center justify-center">
                    <span className="text-header font-bold text-lg">{yearData.year.split("-")[0]}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-gray-900">{yearData.year}</p>
                    <p className="text-base text-gray-500">{yearData.members.length} members</p>
                  </div>
                </div>
                <FaChevronDown
                  className={`text-header transition-transform duration-300 ${
                    expandedYear === yearData.year ? "rotate-180" : ""
                  }`}
                  size={24}
                />
              </button>

              {/* Members Grid - Expandable */}
              {expandedYear === yearData.year && (
                <div className="bg-gray-50 px-8 py-12 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {yearData.members.map((member, memberIndex) => (
                      <div
                        key={memberIndex}
                        className="bg-white rounded-2xl shadow-md hover:shadow-xl border border-gray-100 hover:border-header/30 transition-all duration-500 overflow-hidden group"
                      >
                        {/* Top accent bar */}
                        <div className="h-2 w-full bg-gradient-to-r from-header to-blue-400" />

                        <div className="p-8 flex flex-col items-center gap-6 text-center">
                          {/* Avatar */}
                          <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-header/10 group-hover:ring-header/40 transition-all duration-500 shadow-inner">
                            <img
                              src={member?.avatar}
                              alt={member?.fullName}
                              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  member?.fullName
                                )}&background=3b60c9&color=fff&size=256`;
                              }}
                            />
                          </div>

                          {/* Info */}
                          <div className="space-y-2">
                            <h3 className="font-extrabold text-gray-900 text-xl capitalize group-hover:text-header transition-colors duration-300">
                              {member?.fullName}
                            </h3>
                            <div className="inline-block bg-header/10 text-header text-sm font-bold px-4 py-1.5 rounded-full border border-header/20">
                              {member?.position}
                            </div>
                          </div>

                          {/* Email */}
                          <a
                            href={`mailto:${member?.email}`}
                            className="text-sm font-medium text-gray-500 hover:text-header transition-colors duration-300 flex items-center gap-2 group/email"
                            title={member?.email}
                          >
                            <span className="truncate max-w-[200px]">{member?.email}</span>
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
