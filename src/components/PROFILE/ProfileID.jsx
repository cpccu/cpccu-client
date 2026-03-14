import Button from "@/components/GlobalComponents/Button";

export default function ProfileID() {
  return (
    <main className="bg-white">
      <div className="bg-red-900 h-44 lg:h-60">
        <img src="" alt="cover" />
      </div>

      <div className="flex flex-col gap-6 items-center justify-center  relative -top-16  px-3 lg:px-16 lg:flex-row lg:justify-start lg:items-end">
        <span className="h-36 w-36 lg:h-40 lg:w-40 shrink-0 rounded-full bg-green-900 block ">
          <img src="" alt="profile" />
        </span>
        <div className="text-center lg:text-left">
          <h1 className="text-2xl lg:text-4xl font-bold text-p-text">
            Rahul Roy Nipon
          </h1>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora
            ducimus eius est.
          </p>
        </div>

        <div className="lg:ml-auto">
          <Button title={"Edit"} />
        </div>
      </div>
    </main>
  );
}
