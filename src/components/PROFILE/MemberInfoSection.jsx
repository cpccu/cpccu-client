import { ClipboardList } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { cn } from "@/lib/utils";

const statusStyles = {
  Active: "bg-success/10 text-success",
  Executive: "bg-accent text-accent-foreground",
  Alumni: "bg-muted text-muted-foreground",
};

export function MemberInfoSection({ member }) {
  const rows = [
    { label: "Batch", value: member.batch },
    { label: "Department", value: member.department },
    { label: "Student ID", value: member.universityId },
    { label: "Join Date", value: member.joinDate },
    { label: "Current Position", value: member.role },
    { label: "Phone", value: member.phone },
  ];

  return (
    <SectionCard title="Member Information" icon={ClipboardList} id="member-info">
      <dl className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-right text-sm font-semibold text-foreground">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                statusStyles[member.status] || statusStyles.Active,
              )}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {member.status}
            </span>
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}
