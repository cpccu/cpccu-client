import ContactHeader from "@/components/CONTACT/ContactHeader";
import ContactMain from "@/components/CONTACT/ContactMain";
import ContactScrollProvider from "@/Context/ContactScroll/ContactScrollProvider";

export default function Contact() {
  return (
    <ContactScrollProvider>
      <ContactHeader />
      <ContactMain />
    </ContactScrollProvider>
  );
}
