
"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Clock3,
  UserRound,
  ArrowUpRight,
  AlertCircle,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import type { Interview } from "./interview-types";

type InterviewCardProps = {
  interview: Interview;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  actionsEnabled?: boolean;
};

type PreparationTask = {
  id: string;
  text: string;
  completed: boolean;
};

const defaultTasks: PreparationTask[] = [
  {
    id: "research",
    text: "Research the company and its recent projects",
    completed: false,
  },
  {
    id: "description",
    text: "Review the job description and required skills",
    completed: false,
  },
  {
    id: "answers",
    text: "Prepare answers to common interview questions",
    completed: false,
  },
  {
    id: "questions",
    text: "Prepare questions to ask the interviewer",
    completed: false,
  },
  {
    id: "setup",
    text: "Confirm the interview time and test your setup",
    completed: false,
  },
];

const statusStyles = {
  Pending: "bg-[#FFF4E5] text-[#B45309]",
  Accepted: "bg-[#E3F6EE] text-[#047857]",
  Rejected: "bg-[#F1F2F4] text-[#4B5563]",
  Cancelled: "bg-[#FDE8E8] text-[#B91C1C]",
};

const tileStyles = [
  "bg-[#E8EEFD] text-[#1D4ED8]",
  "bg-[#E3F6EE] text-[#047857]",
  "bg-[#F1EAFE] text-[#7C3AED]",
  "bg-[#FEF3E2] text-[#B45309]",
];

function createDefaultTasks(): PreparationTask[] {
  return defaultTasks.map((task) => ({ ...task }));
}

function isPreparationTask(value: unknown): value is PreparationTask {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const task = value as Record<string, unknown>;

  return (
    typeof task.id === "string" &&
    typeof task.text === "string" &&
    typeof task.completed === "boolean"
  );
}

function InterviewPreparation({
  interviewId,
}: {
  interviewId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<PreparationTask[]>(
    createDefaultTasks
  );
  const [newTask, setNewTask] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);

  const storageKey = `careerconnect-interview-prep-${interviewId}`;

  // Load saved tasks after the component mounts.
  useEffect(() => {
    let active = true;

    const loadTasks = () => {
      let savedTasks = createDefaultTasks();
      let failed = false;

      try {
        const stored = window.localStorage.getItem(storageKey);

        if (stored !== null) {
          const parsed: unknown = JSON.parse(stored);

          if (
            Array.isArray(parsed) &&
            parsed.every(isPreparationTask)
          ) {
            savedTasks = parsed;
          }
        }
      } catch {
        failed = true;
      }

      if (active) {
        setTasks(savedTasks);
        setStorageError(failed);
        setLoaded(true);
      }
    };

    const timeout = window.setTimeout(loadTasks, 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [storageKey]);

  // Save changes locally after the initial load.
  useEffect(() => {
    if (!loaded) return;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(tasks)
      );
    } catch {
      // The checklist remains usable for this session.
    }
  }, [tasks, storageKey, loaded]);

  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round((completedCount / tasks.length) * 100);

  const toggleTask = (taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  };

  const removeTask = (taskId: string) => {
    setTasks((current) =>
      current.filter((task) => task.id !== taskId)
    );
  };

  const addTask = () => {
    const text = newTask.trim();

    if (!text || text.length > 200) return;

    const task: PreparationTask = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };

    setTasks((current) => [...current, task]);
    setNewTask("");
  };

  return (
    <div className="mt-5 border-t border-[#EEF0F3] pt-5">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={`prep-${interviewId}`}
        className="flex w-full items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3151D5]"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EEFD] text-[#3151D5]">
            <ClipboardCheck
              aria-hidden="true"
              className="size-5"
            />
          </span>

          <div>
            <p className="text-sm font-bold text-[#0E1726]">
              Interview preparation
            </p>

            <p className="mt-0.5 text-xs text-[#6B7280]">
              {completedCount} of {tasks.length} tasks completed
            </p>
          </div>
        </div>

        {expanded ? (
          <ChevronUp
            aria-hidden="true"
            className="size-5 text-[#6B7280]"
          />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className="size-5 text-[#6B7280]"
          />
        )}
      </button>

      {/* Completion progress */}
      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Interview preparation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8EEFD]"
        >
          <div
            className="h-full rounded-full bg-[#3151D5] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="min-w-10 text-right text-xs font-bold text-[#3151D5]">
          {progress}%
        </span>
      </div>

      {expanded && (
        <div
          id={`prep-${interviewId}`}
          className="mt-5 rounded-xl border border-[#E3E6EB] bg-[#FAFBFD] p-4 sm:p-5"
        >
          {!loaded ? (
            <p className="text-sm text-[#6B7280]">
              Loading preparation checklist...
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-[#0E1726]">
                  Your preparation checklist
                </h4>

                <span className="rounded-full bg-[#E8EEFD] px-2.5 py-1 text-xs font-semibold text-[#3151D5]">
                  {completedCount}/{tasks.length} completed
                </span>
              </div>

              {tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#D9DEE5] bg-white px-4 py-5 text-center text-sm text-[#6B7280]">
                  No tasks yet. Add a task to get started.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-[#E8EBF0] bg-white px-3 py-3"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id)}
                          className="mt-0.5 size-4 shrink-0 accent-[#3151D5]"
                        />

                        <span
                          className={`min-w-0 text-sm leading-relaxed ${
                            task.completed
                              ? "text-[#9CA3AF] line-through"
                              : "text-[#374151]"
                          }`}
                        >
                          {task.text}
                        </span>
                      </label>

                      {task.completed && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-[#047857]"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        aria-label={`Remove task: ${task.text}`}
                        title="Remove task"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#FDE8E8] hover:text-[#B91C1C] focus-visible:outline-2 focus-visible:outline-[#3151D5]"
                      >
                        <Trash2
                          aria-hidden="true"
                          className="size-4"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add a custom task */}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addTask();
                }}
                className="mt-5 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="text"
                  value={newTask}
                  onChange={(event) =>
                    setNewTask(event.target.value)
                  }
                  placeholder="Add your own preparation task..."
                  aria-label="New preparation task"
                  maxLength={200}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#D9DEE5] bg-white px-4 text-sm text-[#0E1726] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#3151D5] focus:ring-2 focus:ring-[#3151D5]/10"
                />

                <button
                  type="submit"
                  disabled={!newTask.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3151D5] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus
                    aria-hidden="true"
                    className="size-4"
                  />
                  Add task
                </button>
              </form>

              <p className="mt-3 text-xs text-[#9CA3AF]">
                Your checklist is saved in this browser.
              </p>

              {storageError && (
                <p className="mt-2 text-xs text-[#B45309]">
                  Saved tasks could not be loaded. You can still
                  use the checklist.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function InterviewCard({
  interview,
  onAccept,
  onReject,
  actionsEnabled = false,
}: InterviewCardProps) {
  const date = new Date(interview.date);

  const formattedDate = date.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = date.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });

  const companyIndex =
    [...interview.companyName].reduce(
      (total, character) =>
        total + character.charCodeAt(0),
      0
    ) % tileStyles.length;

  const isPending = interview.status === "Pending";
  const isAccepted = interview.status === "Accepted";

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-[0_3px_12px_-8px_rgba(14,23,38,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        isPending
          ? "border-[#F5D9B3]"
          : "border-[#E3E6EB]"
      }`}
    >
      {isPending && (
        <div className="absolute inset-y-0 left-0 w-1 bg-[#F59E0B]" />
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              aria-hidden="true"
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${tileStyles[companyIndex]}`}
            >
              {interview.companyName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-bold text-[#0E1726]">
                {interview.jobTitle}
              </h3>

              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#4B5563]">
                <Building2
                  aria-hidden="true"
                  className="size-4"
                />
                {interview.companyName}
              </p>

              {isPending && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309]">
                  <AlertCircle
                    aria-hidden="true"
                    className="size-3.5"
                  />
                  Response needed
                </p>
              )}
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[interview.status]}`}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-current"
            />
            {interview.status}
          </span>
        </div>

        <div className="mt-5 grid gap-4 border-t border-[#EEF0F3] pt-5 sm:grid-cols-3">
          <div className="flex items-start gap-2.5">
            <CalendarDays
              aria-hidden="true"
              className="mt-0.5 size-4 text-[#3151D5]"
            />

            <div>
              <p className="text-xs font-medium text-[#6B7280]">
                Interview date
              </p>

              <p className="mt-1 text-sm font-bold text-[#0E1726]">
                {formattedDate}
              </p>

              <p className="text-xs text-[#4B5563]">
                {formattedTime}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock3
              aria-hidden="true"
              className="mt-0.5 size-4 text-[#3151D5]"
            />

            <div>
              <p className="text-xs font-medium text-[#6B7280]">
                Duration
              </p>

              <p className="mt-1 text-sm font-bold text-[#0E1726]">
                {interview.durationMinutes} minutes
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <UserRound
              aria-hidden="true"
              className="mt-0.5 size-4 text-[#3151D5]"
            />

            <div>
              <p className="text-xs font-medium text-[#6B7280]">
                Employer
              </p>

              <p className="mt-1 text-sm font-bold text-[#0E1726]">
                {interview.employerName}
              </p>
            </div>
          </div>
        </div>

        {/* Preparation checklist for accepted interviews */}
        {isAccepted && (
          <InterviewPreparation interviewId={interview.id} />
        )}

        {/* Invitation response actions */}
        {isPending && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#EEF0F3] pt-5">
            <button
              type="button"
              disabled={!actionsEnabled || !onAccept}
              onClick={() => onAccept?.(interview.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#3151D5] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accept invitation
              <ArrowUpRight
                aria-hidden="true"
                className="size-4"
              />
            </button>

            <button
              type="button"
              disabled={!actionsEnabled || !onReject}
              onClick={() => onReject?.(interview.id)}
              className="min-h-10 rounded-xl border border-[#D9DEE5] bg-white px-5 text-sm font-semibold text-[#374151] hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Decline
            </button>

            {!actionsEnabled && (
              <p className="text-xs text-[#6B7280]">
                Responses will be available once connected.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
