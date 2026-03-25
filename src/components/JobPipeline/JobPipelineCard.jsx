import JobPipelineCardSkill from "@/components/JobPipeline/JobPipelineCardSkill";
import { FaGithub, FaGlobe } from "react-icons/fa";
import { ImLinkedin } from "react-icons/im";
import { format } from "date-fns";

export default function JobPipelineCard({ data }) {
  const { name, img, tag, phone, email, socials, skills, createdAt } = data;
  const date = new Date(createdAt);
  const formatted = format(date, " dd MMMM, yyyy");

  return (
    <div className="flex flex-col md:flex-row text-gray-600 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] rounded-2xl overflow-hidden text-sm lg:text-[1rem] hover:-translate-y-2 duration-[250ms] ease-in-out group lg:max-h-[32rem] bg-[#adcef891]">
      {/* Left Section: Profile Info */}
      <div className="flex flex-col flex-1 py-6 px-4 md:px-8 border-b md:border-b-0 md:border-r border-[#3b61c957] group-hover:border-[#3b60c9] duration-[250ms]">
        <figure className="rounded-full overflow-hidden self-center mb-4 border-4 border-white shadow-md w-32 h-32 md:w-40 md:h-40 lg:w-36 lg:h-36 xl:w-44 xl:h-44 shrink-0">
          <img
            src={img}
            loading="lazy"
            alt={`${name}'s profile`}
            className="w-full h-full object-cover hover:scale-110 duration-300 transition-transform"
          />
        </figure>
        
        <div className="text-center md:text-left space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-[#3b60c9] leading-tight">
            {name}
          </h2>
          <div className="space-y-1 text-sm md:text-base">
            <p>
              <span className="font-semibold text-black">Title: </span> {tag}
            </p>
            <p>
              <span className="font-semibold text-black">Phone: </span>
              {phone}
            </p>
            <p className="break-all">
              <span className="font-semibold text-black">Email: </span>
              <a href={`mailto:${email}`} className="hover:underline hover:text-[#3b60c9] transition-colors">
                {email}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#3b61c930] pt-4">
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 w-full">
            <div className="flex gap-4">
              <a href={socials.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub Profile">
                <FaGithub className="text-2xl md:text-3xl hover:text-[#3b60c9] hover:scale-110 transition-all text-black" />
              </a>
              <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile">
                <ImLinkedin className="text-2xl md:text-3xl hover:text-[#3b60c9] hover:scale-110 transition-all text-black" />
              </a>
            </div>
            
            {socials.portfolio && (
              <a 
                href={socials.portfolio} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#18181f] text-white px-4 py-1.5 rounded-full text-xs md:text-sm font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-md"
              >
                <FaGlobe className="text-sm" />
                <span>Portfolio</span>
              </a>
            )}
          </div>
          
          {/* <p className="text-xs md:text-sm font-medium w-full text-center md:text-left">
            <span className="text-black/60">Member Since:</span>
            <span className="ml-1 text-black font-semibold">{formatted}</span>
          </p> */}
        </div>
      </div>

      {/* Right Section: Skills */}
      <div className="flex flex-col flex-1 py-6 px-4 md:px-8 bg-white/40">
        <h2 className="text-lg md:text-xl font-bold text-[#3b60c9] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-[#3b60c9] rounded-full"></span>
          Key Skills
        </h2>

        <ul className="flex flex-col gap-3 overflow-y-auto max-h-[15rem] md:max-h-none pr-2 custom-scrollbar">
          {skills.map((skill, index) => (
            <JobPipelineCardSkill key={`${skill.skillName}-${index}`} skill={skill} />
          ))}
        </ul>
      </div>
    </div>
  );
}
