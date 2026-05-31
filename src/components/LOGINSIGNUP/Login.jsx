"use client";

import Image from "next/image";
const Logo = "/assets/logo/cpccu.png";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeftLong } from "@fortawesome/free-solid-svg-icons";
import InputBox from "@/components/LOGINSIGNUP/InputBox";
import { useState, useEffect } from "react";
import {
  useLoginMutation,
  useSendPasswordResetLinkMutation,
} from "@/features/auth/authApi";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials } from "@/features/auth/authSlice";
import SuccessAlert from "../ALERT/SuccessAlert";
import ErrorAlert from "../ALERT/ErrorAlert";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const btn = `uppercase font-semibold h-12 px-1 rounded-full w-full text-sm`;
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);

  const [login, { data, isLoading, isError, isSuccess, error, reset }] =
    useLoginMutation();
  const [
    sendPasswordResetLink,
    {
      data: resetLinkData,
      isLoading: isResetLinkLoading,
      isError: isResetLinkError,
      isSuccess: isResetLinkSuccess,
      error: resetLinkError,
      reset: resetPasswordLinkRequest,
    },
  ] = useSendPasswordResetLinkMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetValidationError, setResetValidationError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (authUser?._id) {
      router.push(`/profile/${authUser._id}`);
    }
  }, [authUser, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userData = { email, password };
      const response = await login(userData).unwrap();

      dispatch(
        setCredentials({
          user: response.data.user,
        }),
      );

      router.push(`/profile/${response.data.user._id}`);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handlePasswordReset = async () => {
    setResetValidationError("");

    if (!email.trim()) {
      setResetValidationError(
        "Enter your email first so we can send the reset link.",
      );
      return;
    }

    try {
      await sendPasswordResetLink({ email: email.trim() }).unwrap();
    } catch (err) {
      console.error("Password reset email failed:", err);
    }
  };

  useEffect(() => {
    if (isSuccess || isError) {
      const timer = setTimeout(() => {
        reset();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, reset]);

  useEffect(() => {
    if (isResetLinkSuccess || isResetLinkError || resetValidationError) {
      const timer = setTimeout(() => {
        resetPasswordLinkRequest();
        setResetValidationError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [
    isResetLinkSuccess,
    isResetLinkError,
    resetValidationError,
    resetPasswordLinkRequest,
  ]);

  return (
    <div>
      <Link href="/">
        <button className="bg-header absolute z-50 right-[2rem] mdd:right-[6rem] mt-[5rem] flex items-center justify-center h-10 rounded-lg lg:w-[10rem] gap-3 px-3 py-2 hover:bg-header-hover trans">
          <FontAwesomeIcon
            className=" text-white font-extrabold text-2xl"
            icon={faArrowLeftLong}
          />
          <h1 className="font-bold text-white hidden md:block">Home Page</h1>
        </button>
      </Link>

      <div className={`h-svh padding flex px-3 pb-12`}>
        <main className="mx-auto lg:min-w-[30rem] lg:w-[60rem] lg:max-w-[70rem] flex flex-col gap-14 items-start justify-center padding">
          <section className="flex flex-col self-center items-center justify-center gap-2">
            <Image
              className="h-24 w-auto"
              src={Logo}
              alt="Logo"
              width={96}
              height={96}
            />
            <h2 className="text-2xl font-custom">Welcome to</h2>
            <h1 className="text-2xl text-center font-semibold text-gray-600">
              Competitive Programming Camp City University
            </h1>
          </section>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
            <InputBox
              type={"email"}
              title={"email"}
              id={"userMail"}
              data={email}
              setData={setEmail}
              autoComplete="email"
            />
            <InputBox
              type={"password"}
              title={"password"}
              id={"userPass"}
              data={password}
              setData={setPassword}
              autoComplete="current-password"
            />

            <section className="flex items-center justify-center gap-5 mt-5">
              <button
                className={`${btn} bg-gradient-to-r from-header-hover to-fuchsia-700 text-white hover:ring trans`}
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
              <button
                className={`${btn} bg-gradient-to-r from-header-hover to-fuchsia-700 text-header hover:ring trans`}
              >
                <Link href="/signup">
                  <div className="bg-white rounded-full h-10 flex items-center justify-center">
                    create account
                  </div>
                </Link>
              </button>
            </section>
            <button
              className="text-center font-semibold mt-6 hover:underline text-header disabled:cursor-wait disabled:opacity-70"
              disabled={isResetLinkLoading}
              onClick={handlePasswordReset}
              type="button"
            >
              {isResetLinkLoading
                ? "Sending reset link..."
                : "Forgot your login details?"}
            </button>
          </form>
        </main>
        <section
          className="w-full items-center justify-center hidden lg:flex relative"
          style={{
            backgroundImage: `url(https://i.ibb.co/pwRqzpN/R-2.png )`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <h1 className="text-3xl font-custom text-gray-500 absolute top-[50%] -left-32 -rotate-90">
            Login to Access Dashboard
          </h1>
        </section>
        {isError && (
          <ErrorAlert
            title="Login failed!"
            text={
              error?.data?.message ||
              "Please check your credentials and try again."
            }
          />
        )}
        {isSuccess && (
          <SuccessAlert title={data?.message || "Login successful!"} />
        )}
        {resetValidationError && (
          <ErrorAlert title="Email required" text={resetValidationError} />
        )}
        {isResetLinkError && (
          <ErrorAlert
            title="Reset email failed!"
            text={resetLinkError?.data?.message || "Please try again."}
          />
        )}
        {isResetLinkSuccess && (
          <SuccessAlert title={resetLinkData?.message || "Reset link sent!"} />
        )}
      </div>
    </div>
  );
}
