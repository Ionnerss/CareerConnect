//This file is to handle each resume card data
"use client";
import { MoreVertical, Pencil, Archive, Trash2, Replace, Download } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import type { ResumeCardData } from "@/lib/resumes/resume_logic";

type ResumeCardProps = {
    resume: ResumeCardData;
}

export function ResumeCard({ resume }: ResumeCardProps) {
    const uploadedDate = resume.uploaded_at ? new Date(resume.uploaded_at).toLocaleDateString() : "Date unknown";

    return (
        <div className="w-full max-w-6xl rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">

                <div className="flex min-w-0 flex-col">
                    <p className="truncate text-lg font-bold">
                        {resume.file_name}
                    </p>

                    <p className="text-sm text-gray-500">
                        Uploaded: {uploadedDate}
                    </p>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Resume options"
                                className="shrink-0"
                            />
                        }
                    >
                        <MoreVertical className="h-5 w-5" />
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </DropdownMenuItem>

                        <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                        </DropdownMenuItem>

                        <DropdownMenuItem>
                            <Replace className="mr-2 h-4 w-4" />
                            Replace
                        </DropdownMenuItem>

                        <DropdownMenuItem>
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                        </DropdownMenuItem>

                        <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>
        </div>
    );
}
