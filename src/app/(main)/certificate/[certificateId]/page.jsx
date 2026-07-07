import CertificatePage from "../page";
import { notFound } from "next/navigation";

export default async function CertificateIdPage({ params }) {
  const { certificateId } = await params;

  if (!certificateId || typeof certificateId !== "string") {
    notFound();
  }

  return <CertificatePage initialCertificateId={certificateId} />;
}
