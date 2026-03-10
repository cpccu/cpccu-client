import React from "react";

export default function History() {
  const milestones = [
    {
      year: "2020",
      title: "The Beginning",
      description: "The CIT University Programming Club was founded to create a collaborative programming community for students interested in technology and software development.",
    },
    {
      year: "2022",
      title: "Community Growth",
      description: "More students joined the club, and regular coding sessions, peer learning activities, and programming discussions became part of the club culture.",
    },
    {
      year: "2024",
      title: "Alumni Engagement",
      description: "Graduated members started contributing back to the community through mentorship, guidance, and occasional donations to support club activities.",
    },
    {
      year: "2026",
      title: "A Continuing Journey",
      description: "Today, the Programming Club continues to grow as a student-driven community, where members learn programming, share knowledge, collaborate on projects, and prepare themselves for careers in technology.",
    },
  ];

  return (
    <main className="padding py-16 bg-white min-h-screen">
      <section className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-header mb-8 text-center">
          Our History
        </h1>

        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-pText mb-4">Foundation</h2>
          <div className="flex flex-col gap-4 text-gray-700 leading-relaxed text-lg">
            <p>
              The City University Programming Club was established in 2020 by a group of passionate students who shared a common interest in programming, technology, and collaborative learning. The club was created with the goal of building a supportive community where students could learn, teach, and grow together.
            </p>
            <p>
              From the beginning, the club focused on creating an environment where students help each other improve their coding skills, explore new technologies, and work on real-world projects. Senior members guide juniors, and everyone contributes to building a strong learning culture.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-pText mb-4">Community & Support</h2>
          <p className="text-gray-700 leading-relaxed text-lg">
            As the club continued to grow, many alumni members remained connected with the community. Some alumni support the club through mentorship, knowledge sharing, and donations, helping the organization organize events, workshops, and learning activities for current students.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-pText mb-8">Milestones</h2>
          <div className="relative border-l-4 border-header ml-4 md:ml-8 pl-8 space-y-12">
            {milestones.map((milestone, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-[42px] top-1 w-4 h-4 bg-header rounded-full border-4 border-white"></div>
                <div className="font-bold text-header text-xl mb-1">{milestone.year}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{milestone.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {milestone.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-pText mb-4">Vision & Evolution</h2>
          <div className="flex flex-col gap-4 text-gray-700 leading-relaxed text-lg">
            <p>
              The CIT University Programming Club aims to build a strong technology community within the university. Our mission is to encourage innovation, teamwork, problem-solving, and continuous learning.
            </p>
            <p>
              By connecting students, alumni, and mentors, the club continues to evolve as a platform where ideas are shared, skills are developed, and future developers are inspired.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
