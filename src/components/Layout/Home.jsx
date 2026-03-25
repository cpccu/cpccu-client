import OurMissionScrollProvider from "@/Context/OurMessionScroll/OurMessonScrollProvider";
import HeroSection from "@/components/HOME/HeroSection";
import EventLayout from "@/components/HOME/eventUpcoming/EventLayout";
import OurMission from "@/components/HOME/OurMission";
import OurResponsibility from "@/components/HOME/OurResponsibility";
import Count from "@/components/HOME/Count";
import GallerySection from "@/components/HOME/GallerySection";
import ContributorsCarousel from "@/components/HOME/ContributorsCarousel";
import VisitorCounter from "@/components/HOME/VisitorCounter";


export default function Home() {
  return (
    <OurMissionScrollProvider>
      <HeroSection />
      <section className="mt-16 lg:mt-0 lg:h-48 h-full relative bg-white">
        <EventLayout
          clName={
            " mx-2 my-14 md:mx-4 md:my-16 lg:mt-0 lg:absolute lg:left-[2rem] lg:right-[2rem]  lg:-top-[11rem] xl:left-[9rem] xl:right-[9rem] xl:-top-[11rem]"
          }
        />
      </section>
      <OurMission />
      <ContributorsCarousel />
      <OurResponsibility />
      <Count />
      <GallerySection />
      <VisitorCounter />
    </OurMissionScrollProvider>
  );
}
