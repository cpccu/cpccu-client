"use client";

import Image from "next/image";
const Logo = "/assets/logo/cpccu.png";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeftLong } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputBox from "@/components/LOGINSIGNUP/InputBox";
import { useRegisterMutation } from "@/features/auth/authApi";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";
import OtpVerifyPopup from "../ALERT/OtpVerifyPopup";

export default function Signup() {
  const router = useRouter();
  const [register, { isLoading, isError, isSuccess, error, reset }] = useRegisterMutation();

  const labelCSS = `uppercase font-semibold text-sm text-gray-800 font-custom`;
  const btn = `uppercase font-semibold h-12 px-1 rounded-full w-full text-sm`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [fullName, setFullName] = useState("");
  const [uniID, setUniID] = useState("");
  const [batch, setBatch] = useState("");
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [registeredUserId, setRegisteredUserId] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    if (password !== confirmPass) {
      setValidationError("Passwords do not match!");
      return;
    }

    try {
      const userData = { email, password, confirm_password: confirmPass, fullName, uniID, batch };
      const response = await register(userData).unwrap();
      const userId = response?.data?._id ?? response?._id;
      if (!userId) {
        console.warn("Registration succeeded but user ID was missing from response.");
      }
      setRegisteredUserId(userId || "");
      setShowOtpPopup(true);
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  useEffect(() => {
    if ((isSuccess || isError || validationError) && !showOtpPopup) {
      const timer = setTimeout(() => {
        reset();
        setValidationError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, validationError, showOtpPopup, reset]);

  return (
    <>
      <Link href="/">
        <button className="bg-header absolute z-30 left-[2rem] mdd:left-[6rem] top-10 md:top-16 flex items-center justify-center h-10 rounded-lg lg:w-[10rem] gap-3 px-3 py-2 hover:bg-header-hover trans">
          <FontAwesomeIcon className=" text-white font-extrabold text-2xl" icon={faArrowLeftLong} />
          <h1 className="font-bold text-white hidden md:block">Home Page</h1>
        </button>
      </Link>

      <div className={`bg-white h-screen padding flex px-3 `}>
        <section
          className="w-full items-center justify-center hidden lg:flex relative"
          style={{
            backgroundImage: `url(https://i.ibb.co/pwRqzpN/R-2.png )`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <h1 className="text-3xl font-custom text-gray-500 absolute top-[50%] -right-20 -rotate-90">
            Sign up to Join CPCCU
          </h1>
        </section>
        <main className="mx-auto w-full lg:min-w-[30rem] lg:w-[60rem] lg:max-w-[70rem] flex flex-col gap-7 items-start justify-center padding">
          <section className="flex flex-col self-center items-center justify-center gap-2">
            <Image className="h-16 md:h-24 w-auto" src={Logo} alt="Logo" width={96} height={96} />
            <h2 className="text-xl md:text-2xl font-custom">Welcome to CPCCU</h2>
          </section>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            <section className="grid grid-cols-12 gap-5">
              <InputBox type={"email"} title={"Email"} id={"userEmail"} clName={"col-span-6"} data={email} setData={setEmail} />
              <InputBox type={"text"} title={"Full name"} id={"userName"} clName={"col-span-6"} data={fullName} setData={setFullName} />
            </section>
            <section className=" grid md:grid-cols-12 gap-5">
              <InputBox type={"number"} title={"CITY UNIVERSITY ID"} id={"userUniID"} clName={"md:col-span-9"} data={uniID} setData={setUniID} />
              <InputBox type={"number"} title={"BATCH NO."} id={"userBatch"} clName={"md:col-span-3"} data={batch} setData={setBatch} />
            </section>
            <InputBox type={"password"} title={"Password"} id={"userPass"} data={password} setData={setPassword} />
            <InputBox type={"password"} title={"confirm password"} id={"userConfirmPass"} data={confirmPass} setData={setConfirmPass} />
            <section className="flex items-center justify-center gap-5 mt-5">
              <button className={`${btn} bg-gradient-to-r from-header-hover to-fuchsia-700 text-header hover:ring trans`}>
                <div className="bg-white rounded-full h-10 flex items-center justify-center">
                  {isLoading ? "Signing Up..." : "Sign Up"}
                </div>
              </button>
              {validationError && <ErrorAlert title="Validation Error" text={validationError} />}
              {isError && <ErrorAlert title="Registration failed!" text={error?.data?.message || "Please check your details."} />}
              {showOtpPopup && (
                <OtpVerifyPopup 
                  email={email} 
                  onVerified={() => {
                    setShowOtpPopup(false);
                    const userId = registeredUserId;
                    router.push(userId ? `/profile/${userId}` : "/login");
                  }} 
                  onClosed={() => setShowOtpPopup(false)} 
                />
              )}
            </section>
          </form>
          <section>
            <h1 className={`${labelCSS} text-lg`}>Already created an account?</h1>
            <Link href={"/login"} className={`${labelCSS} text-lg text-header shadow-sm`}>Log In here!</Link>
          </section>
        </main>
      </div>
    </>
  );
}
