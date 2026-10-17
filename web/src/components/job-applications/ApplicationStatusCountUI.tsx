//This file is for showing total number of applications, In progress, Interview, Offers, Rejected

"use client";
import type { ApplicationStatusCount } from "@/lib/application_status/application_status_logic";

type StatusProps = {
    status_count: ApplicationStatusCount;
}

export function ApplicationStatusCountUI({ status_count }: StatusProps) {

    return (
        <div className="flex items-center justify-center">
            <div className="flex flex-row gap-4">

                <div className="flex w-52 flex-col gap-4 rounded-lg border p-6">
                    <p>Total Applications</p>
                    <p>{status_count.total}</p>
                    <p>Applications submitted</p>
                </div>

                <div className="flex w-52 flex-col gap-4 rounded-lg border p-6">
                    <p>In Progress</p>
                    <p>{status_count.inProgress}</p>
                    <p>Awaiting a decision</p>
                </div>

                <div className="flex w-52 flex-col gap-4 rounded-lg border p-6">
                    <p>Interviews</p>
                    <p>{status_count.interview}</p>
                    <p>Interview Stage</p>
                </div>

                <div className="flex w-52 flex-col gap-4 rounded-lg border p-6">
                    <p>Offers</p>
                    <p>{status_count.offer}</p>
                    <p>Offers Received</p>
                </div>

                <div className="flex w-52 flex-col gap-4 rounded-lg border p-6">
                    <p>Rejected</p>
                    <p>{status_count.rejected}</p>
                    <p>Applications declined</p>
                </div>

            </div>

        </div>
    );

}