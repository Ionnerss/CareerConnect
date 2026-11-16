
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  Inbox,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Timer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InterviewCard from "./InterviewCard";
import { interviewAnchorId } from "@/lib/notifications/notification-links";
import type { Interview, InterviewStatus } from "./interview-types";

type InterviewListProps = {
  interviews: Interview[];
  actionsEnabled?: boolean;
};

const filters = [
  "All",
  "Pending",
  "Accepted",
  "Rejected",
  "Cancelled",
  "Expired",
] as const;

type InterviewFilter = "All" | InterviewStatus;

const HIGHLIGHT_DURATION = 4000;

function getCountdown(targetDate: string, currentTime: number) {
  const target = new Date(targetDate).getTime();
  const difference = Math.max(0, target - currentTime);

  const totalMinutes = Math.floor(difference / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes };
}

function getInterviewIdFromHash(hash: string): string | null {
  if (!hash.startsWith("#interview-")) return null;

  return hash.slice("#interview-".length) || null;
}

export default function InterviewList({
  interviews,
  actionsEnabled = true,
}: InterviewListProps) {
  const router = useRouter();

  const [selectedFilter, setSelectedFilter] =
    useState<InterviewFilter>("All");

  const [highlightedInterviewId, setHighlightedInterviewId] =
    useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);

  // Which upcoming accepted interview is displayed in the carousel.
  const [carouselIndex, setCarouselIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Read the interview selected from Notifications.
  useEffect(() => {
    let frame = 0;

    const updateHighlightedInterview = () => {
      window.cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        const interviewId = getInterviewIdFromHash(
          window.location.hash
        );

        const validInterviewId =
          interviewId &&
          interviews.some((interview) => interview.id === interviewId)
            ? interviewId
            : null;

        setHighlightedInterviewId(validInterviewId);

        if (validInterviewId) {
          setSelectedFilter("All");
        }
      });
    };

    updateHighlightedInterview();

    window.addEventListener(
      "hashchange",
      updateHighlightedInterview
    );

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(
        "hashchange",
        updateHighlightedInterview
      );
    };
  }, [interviews]);

  // Update countdowns every 30 seconds.
  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());

    updateTime();

    const interval = window.setInterval(updateTime, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const handleResponse = async (
    interviewId: string,
    response: "accepted" | "declined"
  ) => {
    if (respondingId || !actionsEnabled) return;

    setRespondingId(interviewId);
    setResponseError(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc("respond_to_interview", {
        p_interview_id: interviewId,
        p_response: response,
      });

      if (error) throw error;

      router.refresh();
    } catch (error) {
      console.error("Failed to respond to interview:", error);

      setResponseError(
        error instanceof Error
          ? error.message
          : "Unable to submit your response."
      );
    } finally {
      setRespondingId(null);
    }
  };

  const counts = useMemo(() => {
    const pending = interviews.filter(
      (item) => item.status === "Pending"
    ).length;

    const accepted = interviews.filter(
      (item) => item.status === "Accepted"
    ).length;

    const rejected = interviews.filter(
      (item) => item.status === "Rejected"
    ).length;

    const cancelled = interviews.filter(
      (item) => item.status === "Cancelled"
    ).length;

    const expired = interviews.filter(
      (item) => item.status === "Expired"
    ).length;

    return {
      All: interviews.length,
      Pending: pending,
      Accepted: accepted,
      Rejected: rejected,
      Cancelled: cancelled,
      Expired: expired,
    };
  }, [interviews]);

  const sortedInterviews = useMemo(() => {
    const priority: Record<InterviewStatus, number> = {
      Pending: 0,
      Accepted: 1,
      Rejected: 2,
      Cancelled: 3,
      Expired: 4,
    };

    return [...interviews].sort((a, b) => {
      const statusDifference =
        priority[a.status] - priority[b.status];

      if (statusDifference !== 0) return statusDifference;

      return (
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
      );
    });
  }, [interviews]);

  const filteredInterviews = useMemo(() => {
    return sortedInterviews.filter(
      (interview) =>
        selectedFilter === "All" ||
        interview.status === selectedFilter
    );
  }, [sortedInterviews, selectedFilter]);

  // Scroll to the selected interview and remove its highlight
  // after four seconds.
  useEffect(() => {
    if (!highlightedInterviewId) return;

    const interviewVisible = filteredInterviews.some(
      (interview) => interview.id === highlightedInterviewId
    );

    if (!interviewVisible) return;

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(
          interviewAnchorId(highlightedInterviewId)
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    });

    const timeout = window.setTimeout(() => {
      setHighlightedInterviewId(null);

      const expectedHash =
        `#${interviewAnchorId(highlightedInterviewId)}`;

      if (window.location.hash === expectedHash) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search
        );
      }
    }, HIGHLIGHT_DURATION);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [highlightedInterviewId, filteredInterviews]);

  // Include ALL future accepted interviews in the carousel.
  const upcomingInterviews = useMemo(() => {
    if (currentTime === null) return [];

    return [...interviews]
      .filter(
        (interview) =>
          interview.status === "Accepted" &&
          new Date(interview.date).getTime() > currentTime
      )
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime()
      );
  }, [interviews, currentTime]);

  const activeCarouselIndex =
    upcomingInterviews.length > 0
      ? Math.min(carouselIndex, upcomingInterviews.length - 1)
      : 0;

  const activeInterview =
    upcomingInterviews[activeCarouselIndex];

  const goToPreviousInterview = () => {
    setCarouselIndex(
      (current) =>
        (Math.min(current, upcomingInterviews.length - 1) -
          1 +
          upcomingInterviews.length) %
        upcomingInterviews.length
    );
  };

  const goToNextInterview = () => {
    setCarouselIndex(
      (current) =>
        (Math.min(current, upcomingInterviews.length - 1) + 1) %
        upcomingInterviews.length
    );
  };

  const overview = [
    {
      label: "Total interviews",
      value: counts.All,
      icon: Inbox,
      color: "bg-[#E8EEFD] text-[#3151D5]",
    },
    {
      label: "Awaiting response",
      value: counts.Pending,
      icon: CalendarClock,
      color: "bg-[#FFF4E5] text-[#B45309]",
    },
    {
      label: "Confirmed",
      value: counts.Accepted,
      icon: CalendarCheck2,
      color: "bg-[#E3F6EE] text-[#047857]",
    },
    {
      label: "Closed",
      value:
        counts.Rejected +
        counts.Cancelled +
        counts.Expired,
      icon: CheckCircle2,
      color: "bg-[#F1F2F4] text-[#4B5563]",
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <section aria-label="Interview overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-[#E3E6EB] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex size-10 items-center justify-center rounded-xl ${item.color}`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-5"
                    />
                  </span>
                </div>

                <p className="mt-4 text-3xl font-extrabold text-[#0E1726]">
                  {item.value}
                </p>

                <p className="mt-1 text-sm font-medium text-[#4B5563]">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {activeInterview && (
        <section aria-labelledby="next-interview-heading">
          <div
            className="relative overflow-hidden rounded-2xl bg-[#111827] p-6 text-white sm:p-7"
            onTouchStart={(event) => {
              touchStartX.current = event.touches[0].clientX;
            }}
            onTouchEnd={(event) => {
              if (
                touchStartX.current === null ||
                upcomingInterviews.length <= 1
              ) {
                return;
              }

              const difference =
                event.changedTouches[0].clientX -
                touchStartX.current;

              touchStartX.current = null;

              if (difference < -50) {
                goToNextInterview();
              } else if (difference > 50) {
                goToPreviousInterview();
              }
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full bg-[#3151D5]/20 blur-3xl"
            />

            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A9C1FF]">
                  {activeCarouselIndex === 0
                    ? "Coming up next"
                    : "Upcoming interview"}
                </p>

                {upcomingInterviews.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#CBD5E1]">
                      {activeCarouselIndex + 1} of{" "}
                      {upcomingInterviews.length}
                    </span>

                    <button
                      type="button"
                      onClick={goToPreviousInterview}
                      aria-label="Previous upcoming interview"
                      className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <ChevronLeft
                        aria-hidden="true"
                        className="size-5"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={goToNextInterview}
                      aria-label="Next upcoming interview"
                      className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className="size-5"
                      />
                    </button>
                  </div>
                )}
              </div>

              {/* Keep every slide mounted so the track can animate between them. */}
              <div className="overflow-hidden" aria-live="polite">
                <div
                  className="flex items-start motion-safe:transition-transform motion-safe:duration-[400ms] motion-safe:ease-in-out motion-reduce:transition-none"
                  style={{
                    transform: `translateX(-${activeCarouselIndex * 100}%)`,
                  }}
                >
                  {upcomingInterviews.map((interview, index) => {
                    const slideCountdown =
                      currentTime !== null
                        ? getCountdown(interview.date, currentTime)
                        : null;

                    return (
                      <div
                        key={interview.id}
                        className="w-full shrink-0"
                        aria-hidden={index !== activeCarouselIndex}
                        inert={index !== activeCarouselIndex}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-5">
                          <div>
                            <h2
                              id={
                                index === activeCarouselIndex
                                  ? "next-interview-heading"
                                  : undefined
                              }
                              className="text-xl font-extrabold sm:text-2xl"
                            >
                              {interview.jobTitle}
                            </h2>

                            <p className="mt-1 text-sm text-[#CBD5E1]">
                              {interview.companyName}
                            </p>

                            <p className="mt-4 flex items-center gap-2 text-sm text-[#E5E7EB]">
                              <Clock3
                                aria-hidden="true"
                                className="size-4 shrink-0"
                              />
                              {interview.durationMinutes}-minute interview with{" "}
                              {interview.employerName}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4">
                            <p className="text-xs font-semibold text-[#CBD5E1]">
                              Interview date
                            </p>

                            <p className="mt-1 text-lg font-bold">
                              {new Date(interview.date).toLocaleDateString(
                                "en-CA",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </p>

                            <p className="mt-1 text-sm text-[#CBD5E1]">
                              {new Date(interview.date).toLocaleTimeString(
                                "en-CA",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                        </div>

                        {slideCountdown && (
                          <div className="mt-6 border-t border-white/15 pt-5">
                            <div className="mb-3 flex items-center gap-2">
                              <Timer
                                aria-hidden="true"
                                className="size-4 text-[#A9C1FF]"
                              />

                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#A9C1FF]">
                                Time until your interview
                              </p>
                            </div>

                            <div
                              role="timer"
                              aria-label={`${slideCountdown.days} days, ${slideCountdown.hours} hours and ${slideCountdown.minutes} minutes remaining`}
                              className="grid max-w-sm grid-cols-3 gap-3"
                            >
                              {[
                                {
                                  label: "Days",
                                  value: slideCountdown.days,
                                },
                                {
                                  label: "Hours",
                                  value: slideCountdown.hours,
                                },
                                {
                                  label: "Minutes",
                                  value: slideCountdown.minutes,
                                },
                              ].map((unit) => (
                                <div
                                  key={unit.label}
                                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-4 text-center"
                                >
                                  <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">
                                    {String(unit.value).padStart(2, "0")}
                                  </p>

                                  <p className="mt-1 text-xs font-medium text-[#CBD5E1]">
                                    {unit.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {upcomingInterviews.length > 1 && (
                <div className="mt-5 flex items-center justify-center gap-2">
                  {upcomingInterviews.map((interview, index) => (
                    <button
                      key={interview.id}
                      type="button"
                      onClick={() => setCarouselIndex(index)}
                      aria-label={`Show upcoming interview ${index + 1}`}
                      aria-current={
                        index === activeCarouselIndex
                          ? "true"
                          : undefined
                      }
                      className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                        index === activeCarouselIndex
                          ? "w-6 bg-[#A9C1FF]"
                          : "w-2 bg-white/30 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="interview-list-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="interview-list-heading"
              className="text-xl font-extrabold text-[#0E1726]"
            >
              Your interviews
            </h2>

            <p className="mt-1 text-sm text-[#4B5563]">
              Review invitations and track your responses.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-[#E8EEFD] px-3 py-1.5 text-xs font-bold text-[#3151D5]">
            {counts.All} total
            <ArrowRight
              aria-hidden="true"
              className="size-3.5"
            />
          </span>
        </div>

        <div
          role="group"
          aria-label="Filter interviews by status"
          className="mb-5 flex flex-wrap gap-2"
        >
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={selectedFilter === filter}
              onClick={() => setSelectedFilter(filter)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3151D5] ${
                selectedFilter === filter
                  ? "bg-[#3151D5] text-white"
                  : "border border-[#D9DEE5] bg-white text-[#374151] hover:bg-[#F5F6F8]"
              }`}
            >
              {filter}

              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                  selectedFilter === filter
                    ? "bg-white/20 text-white"
                    : "bg-[#F1F2F4] text-[#4B5563]"
                }`}
              >
                {counts[filter]}
              </span>
            </button>
          ))}
        </div>

        {responseError && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {responseError}
          </p>
        )}

        {filteredInterviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D9DEE5] bg-white px-6 py-12 text-center">
            <Inbox
              aria-hidden="true"
              className="mx-auto size-9 text-[#94A3B8]"
            />

            <h3 className="mt-3 font-bold text-[#0E1726]">
              No interviews found
            </h3>

            <p className="mt-2 text-sm text-[#6B7280]">
              {selectedFilter === "All"
                ? "Your interview invitations will appear here when available."
                : `You don't have any ${selectedFilter.toLowerCase()} interviews.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredInterviews.map((interview) => (
              <div
                key={interview.id}
                id={interviewAnchorId(interview.id)}
                className={`scroll-mt-24 rounded-2xl transition-all duration-500 ${
                  highlightedInterviewId === interview.id
                    ? "ring-2 ring-[#3151D5]/50 ring-offset-2"
                    : ""
                }`}
              >
                <InterviewCard
                  interview={interview}
                  onAccept={(id) =>
                    handleResponse(id, "accepted")
                  }
                  onReject={(id) =>
                    handleResponse(id, "declined")
                  }
                  actionsEnabled={
                    actionsEnabled && respondingId === null
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
