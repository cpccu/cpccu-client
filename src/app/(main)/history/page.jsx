"use client";

import { motion } from "framer-motion";

export default function History() {
const milestones = [
{
year: "2022",
title: "The Beginning",
description:
"The Competitive Programming Camp City University was founded to create a collaborative programming community for students interested in technology and software development.",
},
{
year: "2023",
title: "Community Growth",
description:
"More students joined the club, and regular coding sessions, peer learning activities, and programming discussions became part of the club culture.",
},
{
year: "2023",
title: "First ICPC Participation",
description:
"In 2023, members of Competitive Programming Camp City University participated in the ICPC for the first time. This milestone marked the club’s entry into international-level programming competitions and motivated more students to engage in competitive programming.",
},
{
year: "2024",
title: "Alumni Engagement",
description:
"Graduated members started contributing back to the community through mentorship, guidance, and occasional donations to support club activities.",
},
{
year: "2026",
title: "A Continuing Journey",
description:
"Today, The Competitive Programming Camp City University continues to grow as a student-driven community, where members learn programming, share knowledge, collaborate on projects, and prepare themselves for careers in technology.",
},
];

return ( <main className="padding py-20 bg-white min-h-screen"> <section className="max-w-5xl mx-auto">

    {/* Title */}
    <h1 className="text-4xl md:text-5xl font-bold text-header mb-12 text-center">
      Our History
    </h1>

    {/* Foundation */}
    <div className="mb-16">
      <h2 className="text-2xl font-semibold text-pText mb-4">Foundation</h2>
      <p className="text-gray-700 leading-relaxed text-lg">
        Competitive Programming Camp City University (CPCCU) was established
        on October 20, 2022, at City University Bangladesh in Khagan, Savar.
        The journey began when Md Shoriful Islam Ashiq (CSE 60), together
        with Md Anisur Rahman Anik (CSE 61), Khandakar Amir Hamza (CSE 58),
        and Roudra Mondal (CSE 60), laid the foundation of a vision that
        continues to grow, inspire, and unite. CPCCU stands as the identity
        of the competitive programmers' community, dedicated to nurturing
        growth and cooperative efforts among coders at all levels.
      </p>
    </div>

    {/* Activities */}
    <div className="mb-16">
      <h2 className="text-2xl font-semibold text-pText mb-4">
        Our Activities
      </h2>

      <p className="text-gray-700 leading-relaxed text-lg mb-3">
        Our goal is to create a dynamic environment for active learning and
        expert guidance. We actively engage in:
      </p>

      <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg space-y-1">
        <li>
          Organizing Weekly, Monthly, Quarterly, and Yearly Programming
          Contests.
        </li>
        <li>
          Taking classes on programming topics for beginner and
          intermediate-level students.
        </li>
        <li>
          Providing rewards, gifts, and Certificates to the participants.
        </li>
      </ul>
    </div>

    {/* Vision */}
    <div className="mb-16">
      <h2 className="text-2xl font-semibold text-pText mb-4">
        Vision & Evolution
      </h2>

      <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg space-y-1">
        <li>
          Inspire and empower students to excel in programming competitions
          and beyond.
        </li>
        <li>
          Foster a culture of inclusiveness, creativity, and innovation
          among club members.
        </li>
        <li>
          Represent the institute and make a positive impact on the
          programming community.
        </li>
      </ul>
    </div>

    {/* Mission */}
    <div className="mb-20">
      <h2 className="text-2xl font-semibold text-pText mb-4">Mission</h2>

      <ul className="list-disc list-inside text-gray-700 leading-relaxed text-lg space-y-1">
        <li>
          Provide a supportive and collaborative environment for learning,
          practicing, and applying advanced programming skills and
          techniques.
        </li>
        <li>
          Compete with other teams at national and international levels and
          showcase the institute’s excellence.
        </li>
        <li>
          Contribute to the development and dissemination of open-source
          software and knowledge.
        </li>
      </ul>
    </div>

    {/* Milestones */}
    <div>
      <h2 className="text-2xl font-semibold text-pText mb-10">
        Milestones
      </h2>

      <div className="relative">

{/* Vertical timeline line */}
<div className="absolute left-6 md:left-1/2 md:-translate-x-1/2 top-0 h-full w-1 bg-header"></div>

<div className="space-y-20">

  {milestones.map((milestone, index) => {
    const isLeft = index % 2 === 0;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="relative grid md:grid-cols-2 gap-10 items-center"
      >

        {/* Content */}
        <div
          className={`pl-16 md:pl-0 ${
            isLeft
              ? "md:text-right md:pr-12"
              : "md:col-start-2 md:pl-12"
          }`}
        >
          <div className="text-header font-bold text-xl mb-2">
            {milestone.year}
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {milestone.title}
          </h3>

          <p className="text-gray-600 leading-relaxed">
            {milestone.description}
          </p>
        </div>

        {/* Timeline Dot */}
        <div className="absolute left-6 md:left-1/2 md:-translate-x-1/2">
          <div className="w-5 h-5 bg-header rounded-full border-4 border-white shadow"></div>
        </div>

      </motion.div>
    );
  })}

</div>

  </div>
</div>

      
  

  </section>
</main>

);
}
