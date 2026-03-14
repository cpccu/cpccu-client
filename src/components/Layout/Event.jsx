import NoticeSection from "@/components/EVENT/NoticeSection";
import EventScrollProvider from "@/Context/EventScroll/EventScrollProvider";
import EventHeader from "@/components/EVENT/EventHeader";

export default function Event() {
  return (
    <EventScrollProvider>
      <EventHeader />
      <NoticeSection />
    </EventScrollProvider>
  );
}
