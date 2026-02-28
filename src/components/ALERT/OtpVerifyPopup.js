"use client";

import { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { useSendOtpMutation, useOtpVerifyMutation } from "@/features/auth/authApi";

export default function OtpVerifyPopup({ email, onVerified }) {
  const OTP_LENGTH = 6; // Can be alphanumeric
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [counter, setCounter] = useState(60);
  const inputsRef = useRef([]);

  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useOtpVerifyMutation();

  // Countdown timer
  useEffect(() => {
    let timer;
    if (counter > 0) timer = setTimeout(() => setCounter(counter - 1), 1000);
    return () => clearTimeout(timer);
  }, [counter]);

  // Handle single input change
  const handleChange = (value, idx) => {
    if (!/^[a-zA-Z0-9]*$/.test(value)) return; // Only alphanumeric
    const newOtp = [...otp];
    newOtp[idx] = value.slice(-1); // Only last char
    setOtp(newOtp);
    if (value && idx < OTP_LENGTH - 1) inputsRef.current[idx + 1].focus();
  };

  // Handle backspace navigation
  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1].focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData
      .getData("text")
      .slice(0, OTP_LENGTH)
      .replace(/[^a-zA-Z0-9]/g, "");
    const newOtp = Array(OTP_LENGTH).fill("");
    pasteData.split("").forEach((char, idx) => newOtp[idx] = char);
    setOtp(newOtp);
    const nextIdx = pasteData.length >= OTP_LENGTH ? OTP_LENGTH - 1 : pasteData.length;
    inputsRef.current[nextIdx].focus();
  };

  // Verify OTP
  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      Swal.fire("Error", `Please enter all ${OTP_LENGTH} characters`, "error");
      return;
    }

    const res = await verifyOtp({ email, otp: code });
    if (res?.data?.success) {
      Swal.fire("Success", "OTP Verified Successfully!", "success");
      onVerified();
    } else {
      Swal.fire("Invalid OTP", res?.error?.data?.message || "Try again", "error");
    }
  };

  // Resend OTP
  const handleResend = async () => {
    const res = await sendOtp({ email });
    if (res?.data?.success) {
      Swal.fire("OTP Sent", "A new OTP has been sent to your email.", "success");
      setCounter(60);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputsRef.current[0].focus();
    } else {
      Swal.fire("Error", "Could not resend OTP.", "error");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white/90 backdrop-blur-md w-full max-w-md rounded-3xl shadow-xl p-6 text-center flex flex-col items-center gap-4 animate-fadeIn">
        <h2 className="text-2xl font-bold">Verify OTP</h2>
        <p className="text-gray-600 text-sm">
          Enter the {OTP_LENGTH}-character code sent to <span className="font-semibold">{email}</span>
        </p>

        <div className="flex justify-between w-full mt-2 mb-4" onPaste={handlePaste}>
          {otp.map((char, idx) => (
            <input
              key={idx}
              type="text"
              maxLength={1}
              value={char}
              ref={el => (inputsRef.current[idx] = el)}
              onChange={e => handleChange(e.target.value, idx)}
              onKeyDown={e => handleKeyDown(e, idx)}
              className="w-12 h-12 text-center text-xl border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white/70"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-50"
        >
          {verifying ? "Verifying..." : "Verify OTP"}
        </button>

        <div className="text-sm text-gray-600 mt-2">
          {counter > 0 ? (
            <span>Resend OTP in {counter}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={sendingOtp}
              className="text-blue-600 hover:underline"
            >
              {sendingOtp ? "Sending..." : "Resend OTP"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}