import committee from "@/data/Committee.json";
import alumni from "@/data/Alumni.json";
import AboutPage from "@/components/ABOUT/AboutPage";

export default function Member() {
  const Data = [...committee, ...alumni];

  return <AboutPage Data={Data} />;
}
