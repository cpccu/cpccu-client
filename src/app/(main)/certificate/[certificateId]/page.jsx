import CertificatePage from "../page";
import { notFound } from "next/navigation";
import { getCertificateMetadata } from "@/lib/certificate-metadata";

export async function generateMetadata({ params }) {
  const { certificateId } = await params;
  return getCertificateMetadata(certificateId);
}

export default async function CertificateIdPage({ params }) {
  const { certificateId } = await params;

  if (!certificateId || typeof certificateId !== "string") {
    notFound();
  }

  return <CertificatePage initialCertificateId={certificateId} />;
}
