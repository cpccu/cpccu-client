import cn from "@/lib/cn";

export default function InputBox({
  type,
  title,
  id,
  placeholder,
  data,
  setData,
  clName,
}) {
  const labelCSS = `uppercase font-semibold text-sm text-gray-800 font-custom`;
  const inputCSS = `outline-none border-b border-gray-300 py-2 focus:border-black bg-gray-100 px-2`;

  return (
    <div className={cn("flex flex-col", clName)}>
      <label className={labelCSS} htmlFor={id}>
        {title}
      </label>
      <input
        onChange={(e) => setData(e.target.value)}
        className={inputCSS}
        type={type}
        id={id}
        placeholder={placeholder}
        value={data}
        required
      />
    </div>
  );
}
