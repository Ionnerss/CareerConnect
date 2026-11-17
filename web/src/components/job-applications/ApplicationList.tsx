
"use client";

import { useEffect, useMemo, useState } from "react";
import { ApplicationCard } from "@/components/job-applications/ApplicationCard";
import Pagination from "@/components/pagination/pagination";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";
import { applicationAnchorId } from "@/lib/notifications/notification-links";

type ApplicationListProps = {
  applications: ApplicationCardData[];
  /** Application opened from a notification. */
  highlightId?: string;
};

const applicationsPerPage = 6;
const HIGHLIGHT_DURATION = 4000;

export function getPageForApplication(
  applications: ApplicationCardData[],
  applicationId: string | undefined,
): number {
  if (!applicationId) return 1;

  const index = applications.findIndex(
    (application) => application.id === applicationId
  );

  return index < 0
    ? 1
    : Math.floor(index / applicationsPerPage) + 1;
}

export default function ApplicationList({
  applications,
  highlightId,
}: ApplicationListProps) {
  const [pageSelection, setPageSelection] = useState<{
    page: number;
    highlightId?: string;
  }>(() => ({
    page: getPageForApplication(applications, highlightId),
    highlightId,
  }));

  // Track whether the notification highlight is still active.
  const [highlightState, setHighlightState] = useState<{
    id?: string;
    active: boolean;
  }>({
    id: highlightId,
    active: Boolean(highlightId),
  });

  const activeHighlightId =
    highlightState.id === highlightId && highlightState.active
      ? highlightId
      : highlightState.id !== highlightId
        ? highlightId
        : undefined;

  const totalPages = Math.ceil(
    applications.length / applicationsPerPage
  );

  // Reset to the target application's page when a different
  // notification is opened, without calling setState in an effect.
  const selectedPageNum =
    pageSelection.highlightId === highlightId
      ? pageSelection.page
      : getPageForApplication(applications, highlightId);

  const currentPage = Math.min(
    selectedPageNum,
    Math.max(1, totalPages)
  );

  const startIndex = (currentPage - 1) * applicationsPerPage;

  const currentApplications = useMemo(
    () =>
      applications.slice(
        startIndex,
        startIndex + applicationsPerPage
      ),
    [applications, startIndex]
  );

  // Scroll to the selected application, highlight it temporarily,
  // and clear its notification selection from the URL.
  useEffect(() => {
    if (!activeHighlightId) return;

    const applicationVisible = currentApplications.some(
      (application) => application.id === activeHighlightId
    );

    if (!applicationVisible) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(applicationAnchorId(activeHighlightId))
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    });

    const timeout = window.setTimeout(() => {
      setHighlightState({
        id: activeHighlightId,
        active: false,
      });

      const url = new URL(window.location.href);
      const expectedHash = `#${applicationAnchorId(activeHighlightId)}`;

      // Only clear the selection for this application.
      if (url.searchParams.get("application") === activeHighlightId) {
        url.searchParams.delete("application");
      }

      if (url.hash === expectedHash) {
        url.hash = "";
      }

      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash
      );
    }, HIGHLIGHT_DURATION);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [activeHighlightId, currentApplications]);

  if (applications.length === 0) {
    return (
      <p className="rounded-2xl border border-[#E3E6EB] bg-white py-12 text-center text-[#4B5563]">
        No applications match your filters.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-col gap-3">
        {currentApplications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            highlighted={application.id === activeHighlightId}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) =>
          setPageSelection({ page, highlightId })
        }
      />
    </div>
  );
}
