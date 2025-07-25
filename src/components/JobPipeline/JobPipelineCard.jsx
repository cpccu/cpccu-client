import JobPipelineCardSkill from "./JobPipelineCardSkill";
import { FaGithub } from "react-icons/fa";
import { ImLinkedin } from "react-icons/im";
import { format } from "date-fns";

export default function JobPipelineCard({ data }) {
  const { name, img, tag, phone, email, socials, skills, createdAt } = data;
  const date = new Date(createdAt);
  const formatted = format(date, ' dd MMMM, yyyy');

  return (
    <div className="flex text-gray-600 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] rounded-2xl overflow-hidden text-sm lg:text-[1rem] hover:-translate-y-2 duration-[250ms] ease-in-out group">
      <div className="flex flex-col flex-1 py-6 px-3 md:px-8 lg:px-3 xl:px-8 border-[1px] border-r-[#3b61c957] group-hover:border-r-[#3b60c9] duration-[250ms]">
        <figure className="rounded-md overflow-hidden self-center mb-2 md:mb-4">
          <img
            src={img}
            loading="lazy"
            alt="profile pice job pipeline"
            className="hover:scale-105 hover:-translate-y-1 duration-200 aspect-square max-w-28 md:max-w-44 lg:max-w-36 xl:max-w-48"
          />
        </figure>
        <h2 className="text-xl md:text-2xl font-semibold lg:text-3xl mb-3 text-[#3b60c9] lg:font-light">
          {name}
        </h2>
        <p>
          <span className="font-semibold text-black">Title: </span> {tag}
        </p>
        <p>
          <span className="font-semibold text-black">Phone: </span>
          {phone}
        </p>
        <a href={`mailto:${email}`} className="mb-4 break-all">
          <span className="font-semibold text-black">Email: </span>
          <span className="hover:underline hover:text-[#3b60c9]">{email}</span>
        </a>
        <div className="flex justify-between items-center flex-col md:flex-row lg:flex-col xl:flex-row gap-2 ">
          <div className="flex gap-4 justify-center items-center">
            <a href={socials.github}>
              <FaGithub className="text-3xl hover:scale-110 duration-150 text-black"/>
            </a>
            <a href={socials.linkedin}>
              <ImLinkedin className="text-3xl hover:scale-110 duration-150 text-black"/>
            </a>
          </div>
          <p>
            <span className="font-semibold text-black">Since: </span>
            {formatted}
          </p>
        </div>
      </div>

      <div className="flex flex-col flex-1 items-start py-4 px-3 md:px-8 lg:px-3 xl:px-8 break-all">
        <h2 className="text-xl md:text-2xl font-semibold text-[#3b60c9] mb-4 self-center ">
          Skills
        </h2>

        <ul className="flex flex-col text-gray-600 gap-3 overflow-y-auto">
          {skills.map((skill)=>{
            return <JobPipelineCardSkill skill={skill} />
          })}
        </ul>
      </div>
    </div>
  );
}