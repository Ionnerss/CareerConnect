
"use client";

import { useState } from "react";

export default function ResumeTabs() {
    const [selectedTab, setSelectedTab] = useState<"active" | "archived">(
        "active"
    );

    return (
        <div className="flex gap-2">
            <button
                type="button"
                onClick={() => setSelectedTab("active")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedTab === "active"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
            >
                Active
            </button>

            <button
                type="button"
                onClick={() => setSelectedTab("archived")}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedTab === "archived"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
            >
                Archived
            </button>
        </div>
    );
}
