"use client";

import Image from "next/image";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeftLong } from "@fortawesome/free-solid-svg-icons";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorAlert from "@/components/ALERT/ErrorAlert";
import SuccessAlert from "@/components/ALERT/SuccessAlert";
import InputBox from "@/components/LOGINSIGNUP/InputBox";
import { useResetPasswordMutation } from "@/features/auth/authApi";

const Logo = "/assets/logo/cpccu.png";

export default function ResetPassword() {
  const { code, token } = useParams();
  const router = useRouter();
  const [resetPassword, { data, error, isError, isLoading, isSuccess, reset }] =
    useResetPasswordMutation();
  const [password, setPassword] = useState("");
  const [retype, setRetype] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setValidationError("");

    if (password !== retype) {
      setValidationError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({ code, token, password, retype }).unwrap();
    } catch (err) {
      console.error("Password reset failed:", err);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => router.push("/login"), 1800);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  useEffect(() => {
    if (isError || validationError) {
      const timer = setTimeout(() => {
        reset();
        setValidationError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isError, reset, validationError]);

  return (
    <div>
      <Link href="/login">
        <button className="bg-header absolute z-50 right-[2rem] mdd:right-[6rem] mt-[5rem] flex items-center justify-center h-10 rounded-lg lg:w-[10rem] gap-3 px-3 py-2 hover:bg-header-hover trans">
          <FontAwesomeIcon className="text-white font-extrabold text-2xl" icon={faArrowLeftLong} />
          <span className="font-bold text-white hidden md:block">Back to Login</span>
        </button>
      </Link>

      <div className="h-svh padding flex px-3 pb-12">
        <main className="mx-auto lg:min-w-[30rem] lg:w-[60rem] lg:max-w-[70rem] flex flex-col gap-14 items-start justify-center padding">
          <section className="flex flex-col self-center items-center justify-center gap-2">
            <Image className="h-24 w-auto" src={Logo} alt="Logo" width={96} height={96} />
            <h1 className="text-2xl text-center font-semibold text-gray-600">
              Reset your CPCCU password
            </h1>
          </section>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
            <InputBox type="password" title="New password" id="resetPassword" data={password} setData={setPassword} />
            <InputBox type="password" title="Retype password" id="resetPasswordRetype" data={retype} setData={setRetype} />
            <button className="uppercase font-semibold h-12 px-1 rounded-full w-full text-sm bg-gradient-to-r from-header-hover to-fuchsia-700 text-white hover:ring trans">
              {isLoading ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        </main>

        <section
          className="w-full items-center justify-center hidden lg:flex relative"
          style={{
            backgroundImage: "url(https://i.ibb.co/pwRqzpN/R-2.png )",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <h2 className="text-3xl font-custom text-gray-500 absolute top-[50%] -left-32 -rotate-90">
            Choose a new password
          </h2>
        </section>

        {validationError && <ErrorAlert title="Password reset failed!" text={validationError} />}
        {isError && <ErrorAlert title="Password reset failed!" text={error?.data?.message || "Please request a new reset link."} />}
        {isSuccess && <SuccessAlert title={data?.message || "Password successfully reset"} />}
      </div>
    </div>
  );
}
