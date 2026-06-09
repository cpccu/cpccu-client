"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { useContext, useEffect, useState } from "react";
import ContactScroll from "@/Context/ContactScroll/ContactScroll";
import { useSendContactMessageMutation } from "@/features/contact/contactApi";

export default function ContactMain() {
  const { setTarget } = useContext(ContactScroll);
  const [sendContactMessage, { isLoading, isSuccess }] = useSendContactMessageMutation();
  const [formData, setFormData] = useState({
    email: "",
    message: "",
    name: "",
    subject: "",
  });
  //add the target for scroll one time

  useEffect(() => {
    setTarget("contactTarget");
  }, []);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendContactMessage(formData).unwrap();
    setFormData({ email: "", message: "", name: "", subject: "" });
  };

  return (
    <main
      id="contactTarget"
      className="px-1 md:px-2 lg:px-[5em] grid  lg:grid-cols-2 gap-10 py-20 bg-responsibility"
    >
      <section className="w-full">
        <iframe
          className="w-full min-h-[500px] border lg:min-h-full shadow-lg"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3648.4657014916597!2d90.30716657483124!3d23.873099478586848!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755c2102dc1cd51%3A0x6f95e92193fc8978!2sCity%20University%20Bangladesh!5e0!3m2!1sen!2sbd!4v1715442173691!5m2!1sen!2sbd"
          allowFullScreen={true}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </section>
      <section className="w-full border bg-white">
        <form onSubmit={handleSubmit} className="p-5 lg:p-8 xl:p-12 flex flex-col gap-5 ">
          <section className="flex items-center gap-2">
            <div className="w-full">
              <label htmlFor="name" className="font-semibold">
                Name
              </label>
              <input
                className="border px-4 py-3 w-full bg-header/10 "
                type="text"
                id="name"
                name="name"
                onChange={handleChange}
                placeholder="Enter your name"
                required
                value={formData.name}
              />
            </div>

            <div className="w-full">
              <label htmlFor="email" className="font-semibold">
                Email
              </label>
              <input
                className="border px-4 py-3 w-full bg-header/10 "
                type="email"
                id="email"
                name="email"
                onChange={handleChange}
                placeholder="Enter your email"
                required
                value={formData.email}
              />
            </div>
          </section>
          <div className="w-full">
            <label htmlFor="subject" className="font-semibold">
              Subject
            </label>
            <input
              className="px-4 py-3 border w-full bg-header/10"
              type="text"
              id="subject"
              name="subject"
              onChange={handleChange}
              placeholder="subject"
              required
              value={formData.subject}
            />
          </div>

          <div className="w-full">
            <label htmlFor="message" className="font-semibold">
              Message
            </label>
            <textarea
              className="border px-4 py-3 bg-header/10 w-full"
              rows={12}
              id="message"
              name="message"
              onChange={handleChange}
              placeholder="Enter your message"
              required
              value={formData.message}
            ></textarea>
          </div>
          <div className="flex justify-center">
            <button className="bg-header flex items-center justify-center gap-3 px-3 py-2 hover:bg-header-hover trans">
              <h1 className="font-bold text-white">{isLoading ? "Sending..." : "Send"}</h1>
              <FontAwesomeIcon className=" text-white" icon={faPaperPlane} />
            </button>
          </div>
          {isSuccess && <p className="font-semibold text-emerald-700">Message sent.</p>}
        </form>
      </section>
    </main>
  );
}
