export default function ProfileNotFound({ id }) {
  return (
    <main className="h-[calc(100svh-200px)] padding my-12  flex flex-col items-center justify-center gap-5">
      <img
        src="https://i.ibb.co/VWt26Yy/Screenshot-2024-05-16-041004.png"
        alt="not found"
      />
      <h1 className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-5 text-2xl lg:text-4xl font-bold text-p-text">
        <span className="text-black/60  font-custom">{id} </span>
        <span className="text-4xl md:text-5xl lg:text-6xl font-extrabold">
          Not found
        </span>
      </h1>
    </main>
  );
}
