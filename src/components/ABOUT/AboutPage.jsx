import AboutCard from "@/components/ABOUT/AboutCard";

export default function AboutPage({ Data }) {
  return (
    <main className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-3 xl:gap-10 padding py-16 bg-responsibility">
      {Data
        ? Data.map((item, index) => <AboutCard key={index} Data={item} />)
        : null}
    </main>
  );
}
