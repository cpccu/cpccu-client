import OurMissionScrollProvider from "@/Context/OurMessionScroll/OurMessonScrollProvider";
import HeroSection from "@/components/HOME/HeroSection";
import EventLayout from "@/components/HOME/eventUpcoming/EventLayout";
import OurMission from "@/components/HOME/OurMission";
import OurResponsibility from "@/components/HOME/OurResponsibility";
import Count from "@/components/HOME/Count";
import GallerySection from "@/components/HOME/GallerySection";
import ContributorsCarousel from "@/components/HOME/ContributorsCarousel";
import VisitorCounter from "@/components/HOME/VisitorCounter";
import DonatorsCarousel from "../HOME/DonatorsCarousel";


export default function Home() {
  return (
    <OurMissionScrollProvider>
      <HeroSection />
      <section className="home-events">
        <EventLayout clName="" />
      </section>
      <OurMission />
      <ContributorsCarousel />
      <OurResponsibility />
      <DonatorsCarousel/>
      <Count />
      <GallerySection />
      <VisitorCounter />
    </OurMissionScrollProvider>
  );
}
