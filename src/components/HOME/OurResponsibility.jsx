import Data from "@/data/home/OurResponsibility.json";

export default function OurResponsibility() {
  return (
    <main className="padding bg-responsibility flex flex-col gap-y-16 py-14 md:py-16 lg:py-20">
      <h1 className="text-center text-3xl md:text-4xl font-bold text-gray-800 capitalize">
        {Data?.header}
      </h1>
      <section className="grid md:grid-cols-2 lg:grid-cols-4 md:gap-x-5 gap-y-12 lg:gap-8">
        {Data?.element.map((item, index) => (
          <CardRes key={index} item={item} />
        ))}
      </section>
    </main>
  );
}

export function CardRes({ item }) {
  return (
    <main className="flex flex-col justify-start items-center gap-5 group">
      <div className="w-[100px] h-[100px] object-cover rounded-full overflow-hidden group-hover:-translate-y-2 trans">
        <img className="w-full h-full" src={item?.img} alt={item?.alt} />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-700 group-hover:text-header trans">
          {item?.header}
        </h1>
        <p className="text-gray-700 mt-3">{item?.conText}</p>
      </div>
    </main>
  );
}
