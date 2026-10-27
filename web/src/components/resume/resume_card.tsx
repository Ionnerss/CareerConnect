"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Archive, Trash2, Replace, Download, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { archiveResume, unarchiveResume, downloadResume, renameResume, replaceResume, deleteResume, viewResume } from "@/lib/resumes/resume_actions_logic";
import type { ResumeCardData } from "@/lib/resumes/resume_logic";

type ResumeCardProps = {
    resume: ResumeCardData;
};

export function ResumeCard({ resume }: ResumeCardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadedDate = resume.uploaded_at
        ? new Date(resume.uploaded_at).toLocaleDateString()
        : "Date unknown";

    async function handleResume() {
        setErrorMessage("");

        startTransition(async () => {
            try {
                if (resume.archived_at) {
                    await unarchiveResume(resume.id);
                } else {
                    await archiveResume(resume.id);
                }

                router.refresh();
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to update resume."
                );
            }
        });
    }

    async function handleDownloadResume() {
        setErrorMessage("");

        startTransition(async () => {
            try {
                const url = await downloadResume(resume.id);
                window.location.assign(url);
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to download resume."
                );
            }
        });
    }

    async function handleRenameResume() {
        const newName = window.prompt("Enter the new filename:", resume.file_name);

        if (newName === null || newName.trim() === "" || newName.trim() === resume.file_name) return;

        setErrorMessage("");

        startTransition(async () => {
            try {
                await renameResume(resume.id, newName);
                router.refresh();
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to rename resume."
                );
            }
        });
    }

    async function handleReplaceResume() {
        fileInputRef.current?.click();
    }

    async function handleReplaceFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        setErrorMessage("");

        startTransition(async () => {
            try {
                await replaceResume(resume.id, formData);
                router.refresh();
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to replace resume."
                );
            }
        });
    }

    async function handleDeleteResume() {
        if (!window.confirm(`Are you sure you want to delete "${resume.file_name}"?`)) return;

        setErrorMessage("");

        startTransition(async () => {
            try {
                await deleteResume(resume.id);
                router.refresh();
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to delete resume."
                );
            }
        });
    }

    async function handleViewResume() {
        setErrorMessage("");

        startTransition(async () => {
            try {
                const url = await viewResume(resume.id);
                window.open(url, "_blank", "noopener,noreferrer");
            } catch (error) {
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to view resume."
                );
            }
        });
    }

    return (
        <div className="w-full rounded-2xl border border-[#E3E6EB] bg-white p-4">
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleReplaceFileChange}
            />

            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                    <p className="truncate text-lg font-bold text-[#0E1726]">
                        {resume.file_name.replace(/\.pdf$/i, "")}
                    </p>

                    <p className="text-sm text-[#4B5563]">
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

                        <DropdownMenuItem
                            onClick={handleViewResume}
                            disabled={isPending}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={handleDownloadResume}
                            disabled={isPending}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={handleRenameResume}
                            disabled={isPending}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Rename
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={handleReplaceResume}
                            disabled={isPending}
                        >
                            <Replace className="mr-2 h-4 w-4" />
                            Replace
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            disabled={isPending}
                            onClick={handleResume}
                        >
                            <Archive className="mr-2 h-4 w-4" />
                            {isPending
                                ? "Updating..."
                                : resume.archived_at
                                    ? "Unarchive"
                                    : "Archive"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            className="text-red-600"
                            onClick={handleDeleteResume}
                            disabled={isPending}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {errorMessage && (
                <p className="mt-2 text-sm text-red-600">
                    {errorMessage}
                </p>
            )}
        </div>
    );
}