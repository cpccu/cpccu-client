"use client";

import Header from "@/components/Global/Header";
import NavBar from "@/components/Global/NavBar";
import Footer from "@/components/Global/Footer";
import GoToTop from "@/components/Global/GoToTop";
import ScrollToTop from "@/app/ScrollToTop";

export default function MainLayout({ children }) {
  return (
    <>
      <ScrollToTop />
      <Header />
      <NavBar />
      {children}
      <Footer />
      <GoToTop />
    </>
  );
}
