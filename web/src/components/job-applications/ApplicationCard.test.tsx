// @vitest-environment jsdom

/** Tests one application on the application status page. */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApplicationCard } from "./ApplicationCard";
import type { ApplicationCardData } from "@/lib/application_status/application_status_logic";

function application(status: string | null): ApplicationCardData {
  return {
    id: "app-1",
    status,
    created_at: "2026-11-01T15:00:00Z",
    job: {
      title: "Software Dev",
      firm_name: "Acme",
      location: "Montreal",
      recruiter_name: "Matthew L",
    },
  };
}

afterEach(() => {
  cleanup();
});

describe("ApplicationCard", () => {
  it("links an application in the interview stage to the interviews page", () => {
    render(<ApplicationCard application={application("Interview")} />);

    expect(
      screen.getByRole("link", { name: "View interview for Software Dev" }).getAttribute("href"),
    ).toBe("/interviews");
  });

  it.each(["In Progress", "Accepted", "Rejected", null])("has no interview link when the status is %s", (status) => {
    render(<ApplicationCard application={application(status)} />);

    expect(screen.queryByRole("link", { name: /View interview/ })).toBeNull();
  });

  it("has an anchor so a notification can open this application", () => {
    const { container } = render(<ApplicationCard application={application("In Progress")} />);

    expect(container.querySelector("#application-app-1")).not.toBeNull();
  });
});
