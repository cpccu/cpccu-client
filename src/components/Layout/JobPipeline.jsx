import JobPipelineHeader from "@/components/JobPipeline/JobPipelineHeader";
import JobPipelineHeroSection from "@/components/JobPipeline/JobPipelineHeroSection";

export default function JobPipeline() {
  return (
    <div className="flex grow min-h-[50svh] flex-col pt-8 pb-12">
      <JobPipelineHeader />
      <JobPipelineHeroSection />
    </div>
  );
}




