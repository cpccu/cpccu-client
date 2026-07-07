import { redirect } from "next/navigation";

export default function VerifyCertificatePage({ params }) {
  const { certificateId } = params;

  if (!certificateId || typeof certificateId !== "string") {
    redirect("/certificate");
  }

  redirect(`/certificate/${encodeURIComponent(certificateId)}`);
}
