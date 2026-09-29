import Hackathon from "@/components/Layout/Hackathon";

// `(main)` is a route group, so this file contributes NO path segment: the page
// is served at `/hackathon`, exactly like `src/app/(main)/event/page.jsx`.
export default function HackathonPage() {
  return <Hackathon />;
}
