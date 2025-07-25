import { FaAngleRight } from "react-icons/fa6";

export default function JobPipelineCardSkill({ skill }) {
  const { skillName, experience } = skill;
  
  return (
    <li>
      <FaAngleRight className="inline text-[#3b60c9] pb-1 pr-1 text-[1.2rem]" />
      <span className="font-semibold text-black">{skillName}: </span>
      <span className="">
        {experience}
      </span>
    </li>
  );
}