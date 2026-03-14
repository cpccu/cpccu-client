import jobPipelineData from "@/data/job-pipeline/Info.json";
import JobPipelineCard from "@/components/JobPipeline/JobPipelineCard";

export default function JobPipelineHeroSection() {
  return (
    <div className="grid lg:grid-cols-2 px-8 py-2 gap-6 lg:gap-10 max-w-[100rem] self-center">
      {jobPipelineData?.map((cur) => {
        return <JobPipelineCard data={cur} key={cur.id} />;
      })}
    </div>
  );
}
