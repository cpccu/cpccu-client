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
import ErrorAlert from "../ALERT/ErrorAlert";
import OtpVerifyPopup from "../ALERT/OtpVerifyPopup";
import PasswordStrength from "@/components/LOGINSIGNUP/PasswordStrength";
import { validatePassword } from "@/lib/password-validation";
import { isValidStudentId, detectScientificNotation, normalizeStudentId } from "@/lib/id-validation";

export default function Signup() {
  const router = useRouter();
  const [register, { isLoading, isError, isSuccess, error, reset }] =
    useRegisterMutation();

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
  const [emailFieldError, setEmailFieldError] = useState("");
  const [uniIDFieldError, setUniIDFieldError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");
    setEmailFieldError("");
    setUniIDFieldError("");

    if (password !== confirmPass) {
      setValidationError("Passwords do not match!");
      return;
    }

    const normalizedUni = normalizeStudentId(uniID);
    if (!normalizedUni) {
      setValidationError("University ID is required.");
      return;
    }
    if (detectScientificNotation(uniID)) {
      setValidationError("University ID cannot be in scientific notation. Please re-enter the full ID.");
      return;
    }
    if (!isValidStudentId(uniID)) {
      setValidationError("University ID must be digits only (6–20 characters, no symbols or spaces).");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setValidationError(
        `Password is too weak: ${passwordValidation.errors.join(", ")}.`,
      );
      return;
    }

    try {
      const userData = {
        email,
        password,
        confirm_password: confirmPass,
        fullName,
        uniID: normalizedUni,
        batch: String(batch).trim(),
      };
      const response = await register(userData).unwrap();
      const userId =
        response?.data?.user?._id ?? response?.data?._id ?? response?._id;
      if (!userId) {
        console.warn(
          "Registration succeeded but user ID was missing from response.",
        );
      }
      setRegisteredUserId(userId || "");
      setShowOtpPopup(true);
    } catch (err) {
      console.error("Registration failed:", err);
      const data = err?.data || err?.originalError || {};
      const fieldErrors = data.errors || {};
      const emailMsg =
        fieldErrors.email ||
        (typeof data.message === "string" && data.message.toLowerCase().includes("email")
          ? data.message
          : "");
      const uniMsg =
        fieldErrors.uniID ||
        (typeof data.message === "string" && data.message.toLowerCase().includes("uni")
          ? data.message
          : "");
      if (emailMsg) setEmailFieldError(emailMsg);
      if (uniMsg) setUniIDFieldError(uniMsg);
    }
  };

  const handleEmailBlur = () => {
    if (!email.trim()) {
      setEmailFieldError("Email address is required.");
      return;
    }
    setEmailFieldError("");
  };

  const handleUniIDBlur = () => {
    if (!uniID.trim()) {
      setUniIDFieldError("Student ID is required.");
      return;
    }
    if (detectScientificNotation(uniID)) {
      setUniIDFieldError("Student ID is in scientific notation. Please enter the full number.");
      return;
    }
    if (!isValidStudentId(uniID)) {
      setUniIDFieldError("Student ID must be digits only (6–20 characters, no symbols or spaces).");
      return;
    }
    setUniIDFieldError("");
  };

  useEffect(() => {
    if ((isSuccess || validationError) && !showOtpPopup) {
      const timer = setTimeout(() => {
        reset();
        setValidationError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, validationError, showOtpPopup, reset]);

  return (
    <>
      <Link href="/">
        <button className="bg-header absolute z-30 left-[2rem] mdd:left-[6rem] top-10 md:top-16 flex items-center justify-center h-10 rounded-lg lg:w-[10rem] gap-3 px-3 py-2 hover:bg-header-hover trans">
          <FontAwesomeIcon
            className=" text-white font-extrabold text-2xl"
            icon={faArrowLeftLong}
          />
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
            <Image
              className="h-16 md:h-24 w-auto"
              src={Logo}
              alt="Logo"
              width={96}
              height={96}
            />
            <h2 className="text-xl md:text-2xl font-custom">
              Welcome to CPCCU
            </h2>
          </section>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            <section className="grid grid-cols-12 gap-5">
              <InputBox
                type={"email"}
                title={"Email"}
                id={"userEmail"}
                clName={"col-span-6"}
                placeholder={"dipty123@mail.com"}
                data={email}
                setData={setEmail}
                autoComplete="email"
                onBlur={handleEmailBlur}
              />
              {emailFieldError && (
                <p className="text-xs font-semibold text-red-600 mt-1 col-span-6">
                  {emailFieldError}
                </p>
              )}
              <InputBox
                type={"text"}
                title={"Full name"}
                id={"userName"}
                placeholder={"Dipty Sorkar"}
                clName={"col-span-6"}
                data={fullName}
                setData={setFullName}
              />
            </section>
            <section className=" grid md:grid-cols-12 gap-5">
              <InputBox
                type={"text"}
                inputMode={"numeric"}
                title={"CITY UNIVERSITY ID"}
                id={"userUniID"}
                placeholder={"027250******"}
                clName={"md:col-span-9"}
                data={uniID}
                setData={setUniID}
                onBlur={handleUniIDBlur}
              />
              {uniIDFieldError && (
                <p className="text-xs font-semibold text-red-600 mt-1 md:col-span-9">
                  {uniIDFieldError}
                </p>
              )}
              <InputBox
                type={"text"}
                inputMode={"numeric"}
                title={"BATCH NO."}
                id={"userBatch"}
                placeholder={"60"}
                clName={"md:col-span-3"}
                data={batch}
                setData={setBatch}
              />
            </section>
            <InputBox
              type={"password"}
              title={"Password"}
              id={"userPass"}
              data={password}
              setData={setPassword}
              autoComplete="new-password"
              invalid={
                password.length > 0 && !validatePassword(password).isValid
              }
            />
            <PasswordStrength password={password} />
            <InputBox
              type={"password"}
              title={"confirm password"}
              id={"userConfirmPass"}
              data={confirmPass}
              setData={setConfirmPass}
              autoComplete="new-password"
              invalid={confirmPass.length > 0 && password !== confirmPass}
            />
            {confirmPass && password !== confirmPass && (
              <p className="text-sm font-semibold text-red-600">
                Passwords do not match.
              </p>
            )}
            <section className="flex items-center justify-center gap-5 mt-5">
              <button
                className={`${btn} bg-gradient-to-r from-header-hover to-fuchsia-700 text-header hover:ring trans`}
              >
                <div className="bg-white rounded-full h-10 flex items-center justify-center">
                  {isLoading ? "Signing Up..." : "Sign Up"}
                </div>
              </button>
              {validationError && (
                <ErrorAlert title="Validation Error" text={validationError} />
              )}
              {isError && (
                <ErrorAlert
                  title="Registration failed!"
                  text={error?.data?.message || "Please check your details."}
                />
              )}
              {showOtpPopup && (
                <OtpVerifyPopup
                  email={email}
                  onVerified={() => {
                    setShowOtpPopup(false);
                    router.push("/login");
                  }}
                  onClosed={() => setShowOtpPopup(false)}
                />
              )}
            </section>
          </form>
          <section>
            <h1 className={`${labelCSS} text-lg`}>
              Already created an account?
            </h1>
            <Link
              href={"/login"}
              className={`${labelCSS} text-lg text-header shadow-sm`}
            >
              Log In here!
            </Link>
          </section>
        </main>
      </div>
    </>
  );
}
