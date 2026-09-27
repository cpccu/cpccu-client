import cn from "@/lib/cn";

export default function Button({ title, img, clName }) {
  return (
    <button
      className={cn(
        "px-3 py-2 bg-header hover:bg-header-hover text-white font-semibold trans",
        clName
      )}
    >
      <p>{title}</p>
    </button>
  );
}
