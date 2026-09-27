// This layout is deliberately a SERVER COMPONENT — it has no `'use client'`
// directive of its own. It is pure composition: it renders five children and
// touches no state, effect or browser API.
//
// Each interactive child opts in independently and carries its own
// `'use client'` (Header, NavBar, GoToTop, ScrollToTop all do; Footer is static
// and correctly has none). Those directives form a boundary at each child, so
// the directive here would be redundant for them AND would have pulled Footer —
// which has no need to ship to the browser — into the client bundle graph.
// Do not re-add it: adding it would re-enlarge the client graph for no gain.
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
