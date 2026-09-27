"use client";

import { useRef, useState } from "react";

export default function uploadResumePage() {
    const [selectResumeFile, setSelectResumeFile] = useState<File | null>(null);
    const [fileStatusMessage, setFileStatusMessage] = useState<string | null>("No file currently selected");
    const resumeFileInputRef = useRef<HTMLInputElement>(null);

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

    function isFiveMbOrLess(file: File): boolean { //Because Supabase has only a 5 Mb limit for file uploads since we have the free plan
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
        setTimeout(() => {
            setFileStatusMessage("No file currently selected");
        }, 2000); // Resetting the inputted file value after 2 seconds for user to see the success message
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

    function uploadResumeFileHandler(event: React.FormEvent<HTMLFormElement>) { //Event handler function when clicking the upload button
        event.preventDefault(); //Prevents the page from refreshing when the form is submitted
        if (!selectResumeFile) {
            setFileStatusMessage('Error: Please select a file before uploading.');
            setTimeout(() => {
                setFileStatusMessage("No file currently selected");
            }, 2000); // Resetting the inputted file value after 2 seconds for user to see the success message
            return;
        }
        setFileStatusMessage('File uploaded successfully');

        setSelectResumeFile(null)

        if (resumeFileInputRef.current) {
            resumeFileInputRef.current.value = ""; //clearing the file input value after the file is uploaded
        }

        setTimeout(() => {
            setFileStatusMessage("No file currently selected");
        }, 2000); // Resetting the inputted file value after 2 seconds for user to see the success message
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <section className="w-full max-w-lg rounded-lg border p-8">

                <h1 className="text-2xl font-semibold">
                    Upload Resume
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
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
                            className="inline-block cursor-pointer rounded-md bg-primary px-4 py-2 text-primary-foreground"
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
                        />
                    </div>

                    {/* Shows the selected file name and X button to remove it */}
                    {/* Shows the selected file name and allows the user to remove it */}
                    {selectResumeFile && (
                        <div className="flex items-center justify-between rounded-md border p-3">

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
                                className="ml-4 rounded-md border border-red-600 bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600" > {/* Not showing as red, got to fix it, not that important */}
                                X
                            </button>

                        </div>
                    )}

                    {/* Uploading the resume */}
                    <button
                        type="submit"
                        className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    >
                        Upload Resume
                    </button>

                    {/* Showing the current status of the file selected based on the conditions */}
                    {fileStatusMessage && (
                        <p className="text-sm">
                            {fileStatusMessage}
                        </p>
                    )}

                </form>
            </section>
        </main>
    );
}



