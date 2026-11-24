export default function BlogMainCard({ Data }) {
  return (
    <main className="bg-white hover:-translate-y-2 trans rounded-xl overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between">
      <section
        className="overflow-hidden h-[220px] sm:h-[250px] relative flex items-end gap-2"
        style={{
          backgroundImage: `url(${Data?.img}`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex py-2 sm:py-3 px-3 sm:px-5 bg-black/60 gap-3 sm:gap-4 max-w-full">
          <img
            className="h-8 sm:h-10 w-8 sm:w-10 rounded-full object-cover shrink-0"
            src={Data?.profile}
            alt="picture"
          />
          <p className="flex flex-col leading-tight shrink-0 text-white font-semibold text-xs sm:text-sm">
            {Data?.name} <span className="text-xs font-light text-white/80">{Data?.date}</span>
          </p>
        </div>
      </section>
      <section className="flex flex-col items-start gap-3 sm:gap-4 p-4 sm:p-6 flex-1 justify-between">
        <div className="space-y-2 w-full">
          <h1 className="text-lg sm:text-2xl font-semibold break-words leading-snug">{Data?.header}</h1>
          <p className="line-clamp-3 sm:line-clamp-4 text-xs sm:text-sm text-gray-600">{Data?.conText}</p>
        </div>
        <button className="px-4 sm:px-5 py-2 mt-2 bg-header text-white hover:bg-gray-800 trans text-xs sm:text-sm font-semibold rounded-md">
          {Data?.btnText}
        </button>
      </section>
    </main>
  );
}
