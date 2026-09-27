"use client";

import cn from "@/lib/cn";
import { useState } from "react";

export default function InputBox({
  type,
  title,
  id,
  placeholder,
  data,
  setData,
  clName,
  autoComplete,
  invalid = false,
  inputMode,
  onBlur,
  className: extraClassName,
}) {
  const labelCSS = `uppercase font-semibold text-sm text-gray-800 font-custom`;
  const inputCSS = `outline-none border-b py-2 focus:border-black bg-gray-100 px-2 ${
    invalid ? "border-red-500" : "border-gray-300"
  }`;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("flex flex-col", clName)}>
      <label className={labelCSS} htmlFor={id}>
        {title}
      </label>
      <div className="relative">
        <input
          onChange={(e) => setData(e.target.value)}
          onBlur={onBlur}
          className={`${inputCSS} w-full ${isPassword ? "pr-16" : ""} ${extraClassName || ''}`}
          type={isPassword && showPassword ? "text" : type}
          id={id}
          placeholder={placeholder}
          value={data}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={invalid}
          required
        />
        {isPassword && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-header"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}
