import { Outlet } from "react-router-dom";
import Header from "./components/Global/Header";
import NavBar from "./components/Global/NavBar";
import Footer from "./components/Global/Footer";
import GoToTop from "./components/Global/GoToTop";
// import SideProfile from "./components/Global/SideProfile";

export default function Layout() {
  return (
    <>
      <Header />
      <NavBar />
      <Outlet />
      <Footer />
      {/* <SideProfile /> */}
      <GoToTop />
    </>
  );
}
