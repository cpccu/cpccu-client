import React from "react";

export default function History() {
  const milestones = [
    {
      year: "2022",
      title: "The Beginning",
      description: "The Competitive Programming Camp City University was founded to create a collaborative programming community for students interested in technology and software development.",
    },
    {
      year: "2023",
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
      description: "Today, The Competitive Programming Camp City University continues to grow as a student-driven community, where members learn programming, share knowledge, collaborate on projects, and prepare themselves for careers in technology.",
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
              Competitive Programming Camp City University (CPCCU) was established on October 20, 2022, at City University Bangladesh in Khagan, Savar. The journey began when Md Shoriful Islam Ashiq (CSE 60), together with Md Anisur Rahman Anik (CSE 61), Khandakar Amir Hamza (CSE 58), and Roudra Mondal (CSE 60), laid the foundation of a vision that continues to grow, inspire, and unite. CPCCU stands as the identity of the competitive programmers' community, dedicated to nurturing growth and cooperative efforts among coders at all levels.
            </p>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-pText mb-4">Our Activities</h2>
          <p className="text-gray-700 leading-relaxed text-lg">
            Our goal is to create a dynamic environment for active learning and expert guidance. We actively engage in:
          </p>
          <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg">
            <li>Organizing Weekly, Monthly, Quarterly, and Yearly Programming Contests.</li>
            <li>Taking classes on programming topics for beginner and intermediate-level students.</li>
            <li>Providing rewards, gifts, and importantly, Certificates to the participants.</li>
          </ul>
        </div>



        <div className="mb-16">
           <h2 className="text-2xl font-semibold text-pText mb-4">Vision & Evolution</h2>
          <div className="flex flex-col gap-4 text-gray-700 leading-relaxed text-lg">
            <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg">
              <li>Inspire and empower students to excel in programming competitions and beyond.</li>
              <li>Foster a culture of inclusiveness, creativity, and innovation among club members.</li>
              <li>Represent the institute and make a positive impact on the programming community.</li>
            </ul>
          </div>
        </div>


        <div className="mb-16">
           <h2 className="text-2xl font-semibold text-pText mb-4">Mission</h2>
          <div className="flex flex-col gap-4 text-gray-700 leading-relaxed text-lg">
            <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg">
              <li>Provide a supportive and collaborative environment for learning, practicing, and applying advanced programming skills and techniques.</li>
              <li>Compete with other teams at national and international levels and showcase the institute’s excellence.</li>
              <li>Contribute to the development and dissemination of open-source software and knowledge.</li>
            </ul>
          </div>
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
      </section>
    </main>
  );
}
