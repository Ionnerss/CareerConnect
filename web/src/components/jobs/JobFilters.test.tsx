
/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobFilters from "./JobFilters";

// Clean up rendered components after each test
afterEach(() => {
  cleanup();
});

describe("JobFilters", () => {
  it("renders all required filters and buttons", () => {
    render(<JobFilters onApply={vi.fn()} />);

    expect(screen.getByLabelText("Location")).toBeTruthy();
    expect(screen.getByLabelText("Minimum salary ($)")).toBeTruthy();
    expect(screen.getByLabelText("Maximum salary ($)")).toBeTruthy();
    expect(screen.getByLabelText("Experience level")).toBeTruthy();
    expect(screen.getByLabelText("Job type")).toBeTruthy();

    expect(
      screen.getByRole("button", { name: "Apply Filters" })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: "Clear Filters" })
    ).toBeTruthy();
  });

  it("applies selected filters and displays them", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    await user.type(
      screen.getByLabelText("Location"),
      "Montreal"
    );

    await user.type(
      screen.getByLabelText("Minimum salary ($)"),
      "50000"
    );

    await user.type(
      screen.getByLabelText("Maximum salary ($)"),
      "100000"
    );

    await user.selectOptions(
      screen.getByLabelText("Experience level"),
      "Entry Level"
    );

    await user.selectOptions(
      screen.getByLabelText("Job type"),
      "Full-time"
    );

    await user.click(
      screen.getByRole("button", { name: "Apply Filters" })
    );

    expect(onApply).toHaveBeenCalledWith({
      location: "Montreal",
      minSalary: "50000",
      maxSalary: "100000",
      experienceLevel: "Entry Level",
      jobType: "Full-time",
    });

    expect(
      screen.getByText("Location: Montreal")
    ).toBeTruthy();

    expect(
      screen.getByText("Min salary: $50000")
    ).toBeTruthy();

    expect(
      screen.getByText("Max salary: $100000")
    ).toBeTruthy();

    expect(
      screen.getByText("Experience: Entry Level")
    ).toBeTruthy();

    expect(
      screen.getByText("Job type: Full-time")
    ).toBeTruthy();
  });

  it("clears all filters", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    await user.type(
      screen.getByLabelText("Location"),
      "Toronto"
    );

    await user.click(
      screen.getByRole("button", { name: "Apply Filters" })
    );

    await user.click(
      screen.getByRole("button", { name: "Clear Filters" })
    );

    expect(onApply).toHaveBeenLastCalledWith({
      location: "",
      minSalary: "",
      maxSalary: "",
      experienceLevel: "",
      jobType: "",
    });

    expect(
      (screen.getByLabelText("Location") as HTMLInputElement).value
    ).toBe("");

    expect(
      screen.queryByText("Location: Toronto")
    ).toBeNull();
  });

  it("rejects an invalid salary range", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    await user.type(
      screen.getByLabelText("Minimum salary ($)"),
      "100000"
    );

    await user.type(
      screen.getByLabelText("Maximum salary ($)"),
      "50000"
    );

    await user.click(
      screen.getByRole("button", { name: "Apply Filters" })
    );

    expect(
      screen.getByRole("alert").textContent
    ).toContain(
      "Minimum salary cannot exceed maximum salary."
    );

    expect(onApply).not.toHaveBeenCalled();
  });
});
