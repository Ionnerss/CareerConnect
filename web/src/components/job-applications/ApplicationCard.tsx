//This file is to display one application card information, Job title, company, application date, status, view details

"use client";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

type CardDataProps = {
    application: ApplicationCardData;
};

export function ApplicationCard({ application }: CardDataProps) {


    return (
        <div className="w-full max-w-6xl rounded-lg border p-4">
            <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr] items-center gap-4">

                <div className="flex min-w-0 flex-col">
                    <p className="truncate text-lg font-bold">
                        {application.job?.title ?? "Position name not specified"}
                    </p>

                    <div className="flex flex-row gap-2 text-sm text-gray-500">
                        <p>{application.job?.firm_name ?? "Company name not specified"}</p>
                        <span>•</span>
                        <p>{application.job?.location ?? "Location not specified"}</p>
                    </div>
                </div>

                <p className="text-gray-500">
                    <span className="font-bold">Employer: </span>
                    {application.job?.recruiter_name ?? "Employer name not specified"}
                </p>

                <p className="text-sm text-gray-500">
                    Applied {application.created_at ?? "at time not specified"}
                </p>

                <p className="font-medium">
                    {application.status}
                </p>

            </div>
        </div>
    );

}