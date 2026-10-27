"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recoverResumeSaveOutcome } from "@/lib/resumes/recover-upload";
import { useRouter } from "next/navigation";

export default function UploadResumePage() {
    const [selectResumeFile, setSelectResumeFile] = useState<File | null>(null);
    const [fileStatusMessage, setFileStatusMessage] = useState<string | null>("No file currently selected");
    const [isUploading, setIsUploading] = useState(false);
    const resumeFileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    function isPdf(file: File): boolean {
        return file.type === "application/pdf";
    }

    function validatePdfFile(file: File): boolean { //Updating the Status message for validation
        if (!isPdf(file)) {
            setFileStatusMessage("Not a PDF file. Please select a PDF file.");
            return false;
        }
        return true;
    }

    function isFiveMbOrLess(file: File): boolean { //CareerConnect limits resume uploads to 5 MB
        const maxSizeInBytes = 5 * 1024 * 1024; //1024 bytes is 1 Kb 
        return file.size <= maxSizeInBytes;
    }

    function validateFileSize(file: File): boolean { //Updating the Status message for validation
        if (!isFiveMbOrLess(file)) {
            setFileStatusMessage("File size exceeds 5 MB limit");
            return false;
        }
        return true;
    }

    function removeSelectedResumeFile() {
        setSelectResumeFile(null);
        if (resumeFileInputRef.current) {
            resumeFileInputRef.current.value = ""; // Clearing the file input value
        }
        setFileStatusMessage("File removed successfully");
    }

    function selectResumeFileHandler(event: React.ChangeEvent<HTMLInputElement>) { //Event handler function when clicking select a file

        const resumeFile = event.target.files?.[0] || null;
        setSelectResumeFile(resumeFile);

        if (!resumeFile) {
            setFileStatusMessage('No file selected');
            return;
        }

        if (!validatePdfFile(resumeFile)) {
            setSelectResumeFile(null);
            return;
        }

        if (!validateFileSize(resumeFile)) {
            setSelectResumeFile(null);
            return;
        }

        setFileStatusMessage("PDF file is selected and is within the 5 MB limit");
    }

    async function uploadResumeFileHandler(event: React.FormEvent<HTMLFormElement>) { //Event handler function when clicking the upload button
        event.preventDefault();

        if (isUploading) {
            return;
        }

        const file = selectResumeFile;

        if (!file) {
            setFileStatusMessage("Error: Please select a file before uploading.");
            return;
        }

        if (!validatePdfFile(file) || !validateFileSize(file)) {
            setSelectResumeFile(null);
            return;
        }

        setIsUploading(true);
        setFileStatusMessage("Uploading resume...");

        try {
            const supabase = createClient();

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                setFileStatusMessage(
                    "Please sign in before uploading a resume."
                );
                return;
            }

            const filePath = `${user.id}/${crypto.randomUUID()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from("resumes")
                .upload(filePath, file, {
                    upsert: false,
                    contentType: "application/pdf",
                });

            if (uploadError) {
                setFileStatusMessage(
                    "Unable to upload resume. Please try again."
                );
                return;
            }

            const { error: insertError } = await supabase
                .from("resumes")
                .insert({
                    user_id: user.id,
                    file_path: filePath,
                    file_name: file.name,
                });

            if (insertError) {
                const recovery = await recoverResumeSaveOutcome(async () => {
                    const {
                        data: savedResume,
                        error: verificationError,
                    } = await supabase
                        .from("resumes")
                        .select("id")
                        .eq("user_id", user.id)
                        .eq("file_path", filePath)
                        .maybeSingle();

                    return {
                        data: savedResume,
                        error: verificationError,
                    };
                });

                if (recovery.status === "uncertain") {
                    setFileStatusMessage(
                        "We couldn't confirm whether your resume was saved. Retrying may create a duplicate."
                    );
                    return;
                }

                // The row exists, so continue to the success handling below.
            }

            setFileStatusMessage("Resume uploaded successfully.");
            setSelectResumeFile(null);

            if (resumeFileInputRef.current) {
                resumeFileInputRef.current.value = "";
            }
            router.refresh();
        } catch (error) {
            console.error("Unexpected resume upload error:", error);
            setFileStatusMessage(
                "We couldn't confirm whether your resume was saved. Retrying may create a duplicate."
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="flex w-full justify-center">
            <section className="w-full rounded-2xl border border-[#E3E6EB] bg-white p-6 sm:p-8">

                <h2 className="text-xl font-extrabold tracking-tight text-[#0E1726]">
                    Upload Resume
                </h2>

                <p className="mt-2 text-sm text-[#4B5563]">
                    Upload your resume in PDF format. Please ensure the file size does not exceed 5 MB.
                </p>

                <form
                    onSubmit={uploadResumeFileHandler}
                    className="mt-6 space-y-5"
                >

                    {/* Getting the input for the resume file */}
                    <div>
                        <label
                            htmlFor="resume"
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-[#E8EEFD] px-5 text-sm font-bold text-[#1E40AF] transition-colors hover:bg-[#D6E1FB] focus-within:outline-2 has-[:focus-visible]:outline-[#1D4ED8]"
                        >
                            Select File
                        </label>

                        <input
                            ref={resumeFileInputRef}
                            id="resume"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={selectResumeFileHandler}
                            className="hidden"
                            disabled={isUploading}
                        />
                    </div>

                    {/* Shows the selected file name and X button to remove it */}
                    {/* Shows the selected file name and allows the user to remove it */}
                    {selectResumeFile && (
                        <div className="flex items-center justify-between rounded-xl border border-[#E3E6EB] bg-[#F5F6F8] p-3">

                            {/* Shows the selected file */}
                            <div>
                                <p className="text-sm">
                                    Selected file:
                                </p>

                                <p className="mt-1 text-sm font-medium">
                                    {selectResumeFile.name}
                                </p>
                            </div>

                            {/* X button to remove the selected file */}
                            <button
                                type="button"
                                onClick={removeSelectedResumeFile}
                                disabled={isUploading}
                                className="ml-4 min-h-10 rounded-xl bg-[#FDE8E8] px-3 text-sm font-bold text-[#9B1C1C] transition-colors hover:bg-[#FAD1D1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                X
                            </button>

                        </div>
                    )}

                    {/* Uploading the resume */}
                    <button
                        type="submit"
                        disabled={isUploading}
                        className="min-h-12 w-full rounded-xl bg-[#1D4ED8] px-4 text-base font-bold text-white transition-colors hover:bg-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50">
                        {isUploading ? "Uploading..." : "Upload Resume"}
                    </button>

                    {/* Showing the current status of the file selected based on the conditions */}
                    {fileStatusMessage && (
                        <p className="text-sm" aria-live="polite">
                            {fileStatusMessage}
                        </p>
                    )}

                </form>
            </section>

        </div>
    );
}



