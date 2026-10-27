//This file is for showing total number of applications, In progress, Interview, Offers, Rejected

"use client";
import type { ApplicationStatusCount } from "@/lib/application_status/application_status_logic";

type StatusProps = {
    status_count: ApplicationStatusCount;
}

export function ApplicationStatusCountUI({ status_count }: StatusProps) {
    const cells = [
        { label: "Total Applications", value: status_count.total, note: "Applications submitted", dot: "bg-[#0E1726]" },
        { label: "In Progress", value: status_count.inProgress, note: "Awaiting a decision", dot: "bg-[#1D4ED8]" },
        { label: "Interviews", value: status_count.interview, note: "Interview Stage", dot: "bg-[#B45309]" },
        { label: "Offers", value: status_count.offer, note: "Offers Received", dot: "bg-[#047857]" },
        { label: "Rejected", value: status_count.rejected, note: "Applications declined", dot: "bg-[#6B7280]" },
    ];

    return (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cells.map((cell) => (
                <div
                    key={cell.label}
                    className="flex flex-col gap-1 rounded-2xl border border-[#E3E6EB] bg-white p-4 shadow-[0_10px_30px_-18px_rgba(14,23,38,0.35)]"
                >
                    <dt className="flex items-center gap-1.5 text-xs font-semibold text-[#4B5563]">
                        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cell.dot}`} />
                        {cell.label}
                    </dt>
                    <dd className="text-3xl font-extrabold tracking-tight text-[#0E1726] tabular-nums">
                        {cell.value}
                    </dd>
                    <p className="text-xs text-[#4B5563]">{cell.note}</p>
                </div>
            ))}
        </dl>
    );
}
