//This file is to display one application card information, Job title, company, application date, status, view details

"use client";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import {
    getCompanyTileIndex,
    getStatusLabel,
    getStatusTone,
    type StatusTone,
} from "@/lib/dashboard/summary";

type CardDataProps = {
    application: ApplicationCardData;
};

// Same colours as the dashboard so an application looks the same everywhere.
const TILE_STYLES = [
    "bg-[#E8EEFD] text-[#1E40AF]",
    "bg-[#FEF3E2] text-[#92400E]",
    "bg-[#E3F6EE] text-[#065F46]",
    "bg-[#F1EAFE] text-[#5B21B6]",
    "bg-[#FDE8E8] text-[#9B1C1C]",
    "bg-[#E0F2F7] text-[#155E75]",
];

const STATUS_STYLES: Record<StatusTone, string> = {
    progress: "bg-[#E8EEFD] text-[#1D4ED8]",
    interview: "bg-[#FEF3E2] text-[#B45309]",
    offer: "bg-[#E3F6EE] text-[#047857]",
    rejected: "bg-[#F1F2F4] text-[#4B5563]",
    unknown: "bg-[#F1F2F4] text-[#4B5563]",
};

export function ApplicationCard({ application }: CardDataProps) {

    const created_at = application.created_at ? new Date(application.created_at).toLocaleDateString(): "Date unknown";
    const company = application.job?.firm_name?.trim() || "Company name not specified";
    const tile = TILE_STYLES[getCompanyTileIndex(application.job?.firm_name)];
    const tone = getStatusTone(application.status);

    return (
        <div className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-[#E3E6EB] bg-white p-4 sm:flex-nowrap">
            <span
                aria-hidden="true"
                className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${tile}`}
            >
                {company[0].toUpperCase()}
            </span>

            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                <p className="line-clamp-2 font-bold text-[#0E1726] sm:truncate">
                    {application.job?.title ?? "Position name not specified"}
                </p>
                <p className="truncate text-sm text-[#4B5563]">
                    {company} • {application.job?.location ?? "Location not specified"}
                </p>
            </div>

            <p className="basis-44 text-sm text-[#4B5563]">
                <span className="font-semibold text-[#0E1726]">Employer: </span>
                {application.job?.recruiter_name ?? "Employer name not specified"}
            </p>

            <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[tone]}`}
                >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {getStatusLabel(application.status)}
                </span>
                <span className="font-mono text-[11px] text-[#4B5563]">
                    Applied: {created_at}
                </span>
            </div>
        </div>
    );

}
