import { ClipboardList } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { getDisplayRole } from "@/lib/roles";

export function MemberInfoSection({ member }) {
  const rows = [
    { label: "Department", value: "Computer Science & Engineering" },
    { label: "Batch", value: member.batch },
    { label: "Section", value: member.section },
    { label: "Student ID", value: member.universityId },
    { label: "Member Since", value: member.joinDate || member.memberSince },
    { label: "Official Role", value: getDisplayRole(member.officialRole) },
    { label: "Phone", value: member.phone },
  ];

  return (
    <SectionCard title="Member Information" icon={ClipboardList} id="member-info">
      <dl className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-sm font-semibold text-foreground">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
