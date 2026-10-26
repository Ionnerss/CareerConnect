
/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobFilters from "./JobFilters";

// Radix UI Slider uses ResizeObserver, which jsdom does not provide.
beforeAll(() => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

// Clean up rendered components after every test.
afterEach(() => {
  cleanup();
});

describe("JobFilters", () => {
  it("renders all required filters and buttons", async () => {
    const user = userEvent.setup();

    render(<JobFilters onApply={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /Location/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Salary range/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Experience/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Job type/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Apply filters/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Clear all/i })
    ).toBeTruthy();

    // Open location dropdown.
    await user.click(
      screen.getByRole("button", { name: /Location/i })
    );

    expect(
      screen.getByLabelText("Preferred location")
    ).toBeTruthy();

    // Open salary dropdown.
    await user.click(
      screen.getByRole("button", { name: /Salary range/i })
    );

    expect(
      screen.getByLabelText("Minimum")
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Maximum")
    ).toBeTruthy();

    // Verify the dual-handle slider is rendered.
    expect(
      screen.getByRole("slider", { name: "Minimum salary" })
    ).toBeTruthy();

    expect(
      screen.getByRole("slider", { name: "Maximum salary" })
    ).toBeTruthy();

    // Open experience dropdown.
    await user.click(
      screen.getByRole("button", { name: /Experience/i })
    );

    expect(
      screen.getByLabelText("Experience level")
    ).toBeTruthy();

    // Open job type dropdown.
    await user.click(
      screen.getByRole("button", { name: /Job type/i })
    );

    expect(
      screen.getByLabelText("Job type")
    ).toBeTruthy();
  });

  it("applies selected filters and displays them", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    // Set location.
    await user.click(
      screen.getByRole("button", { name: /Location/i })
    );

    await user.type(
      screen.getByLabelText("Preferred location"),
      "Montreal"
    );

    // Set salary range.
    await user.click(
      screen.getByRole("button", { name: /Salary range/i })
    );

    await user.type(
      screen.getByLabelText("Minimum"),
      "50000"
    );

    await user.type(
      screen.getByLabelText("Maximum"),
      "100000"
    );

    // Set experience level.
    await user.click(
      screen.getByRole("button", { name: /Experience/i })
    );

    await user.selectOptions(
      screen.getByLabelText("Experience level"),
      "Entry Level"
    );

    // Set job type.
    await user.click(
      screen.getByRole("button", { name: /Job type/i })
    );

    await user.selectOptions(
      screen.getByLabelText("Job type"),
      "Full-time"
    );

    // Apply all selected filters.
    await user.click(
      screen.getByRole("button", { name: /Apply filters/i })
    );

    expect(onApply).toHaveBeenCalledWith({
      location: "Montreal",
      minSalary: "50000",
      maxSalary: "100000",
      experienceLevel: "Entry Level",
      jobType: "Full-time",
    });

    // Verify applied filters appear on the toolbar.
    expect(
      screen.getByRole("button", { name: /Montreal/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Entry Level/i })
    ).toBeTruthy();

    expect(
      screen.getByRole("button", { name: /Full-time/i })
    ).toBeTruthy();

    expect(
      screen.getByText(/5 active filters/i)
    ).toBeTruthy();
  });

  it("clears all filters", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    // Enter a location.
    await user.click(
      screen.getByRole("button", { name: /Location/i })
    );

    await user.type(
      screen.getByLabelText("Preferred location"),
      "Toronto"
    );

    await user.click(
      screen.getByRole("button", { name: /Apply filters/i })
    );

    expect(onApply).toHaveBeenLastCalledWith({
      location: "Toronto",
      minSalary: "",
      maxSalary: "",
      experienceLevel: "",
      jobType: "",
    });

    // Clear all selected filters.
    await user.click(
      screen.getByRole("button", { name: /Clear all/i })
    );

    expect(onApply).toHaveBeenLastCalledWith({
      location: "",
      minSalary: "",
      maxSalary: "",
      experienceLevel: "",
      jobType: "",
    });

    expect(
      screen.getByText(/0 active filters/i)
    ).toBeTruthy();

    // Verify the location input is cleared.
    await user.click(
      screen.getByRole("button", { name: /Location/i })
    );

    expect(
      (
        screen.getByLabelText(
          "Preferred location"
        ) as HTMLInputElement
      ).value
    ).toBe("");
  });

  it("rejects an invalid salary range", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    // Open salary dropdown.
    await user.click(
      screen.getByRole("button", { name: /Salary range/i })
    );

    // Minimum is greater than maximum.
    await user.type(
      screen.getByLabelText("Minimum"),
      "100000"
    );

    await user.type(
      screen.getByLabelText("Maximum"),
      "50000"
    );

    await user.click(
      screen.getByRole("button", { name: /Apply salary range/i })
    );

    expect(
      screen.getByRole("alert").textContent
    ).toContain(
      "Minimum salary cannot exceed maximum salary."
    );

    // Invalid filters must not be submitted.
    expect(onApply).not.toHaveBeenCalled();
  });

  it("displays experience ranges while preserving backend values", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    await user.click(
      screen.getByRole("button", { name: /Experience/i })
    );

    const experienceSelect = screen.getByLabelText(
      "Experience level"
    ) as HTMLSelectElement;

    expect(
      screen.getByRole("option", { name: /Entry Level.*0.*2 years/i })
    ).toHaveProperty("value", "Entry Level");

    expect(
      screen.getByRole("option", { name: /Mid Level.*3.*5 years/i })
    ).toHaveProperty("value", "Mid Level");

    expect(
      screen.getByRole("option", { name: /Senior Level.*6\+/i })
    ).toHaveProperty("value", "Senior Level");

    await user.selectOptions(experienceSelect, "Senior Level");

    await user.click(
      screen.getByRole("button", { name: /Apply filters/i })
    );

    expect(onApply).toHaveBeenLastCalledWith({
      location: "",
      minSalary: "",
      maxSalary: "",
      experienceLevel: "Senior Level",
      jobType: "",
    });
  });

  it("preserves a manually entered salary above the slider maximum", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(<JobFilters onApply={onApply} />);

    await user.click(
      screen.getByRole("button", { name: /Salary range/i })
    );

    const minimumInput = screen.getByLabelText(
      "Minimum"
    ) as HTMLInputElement;

    const maximumInput = screen.getByLabelText(
      "Maximum"
    ) as HTMLInputElement;

    await user.type(minimumInput, "80000");
    await user.type(maximumInput, "250000");

    expect(minimumInput.value).toBe("80000");
    expect(maximumInput.value).toBe("250000");

    // Update only the minimum thumb using the keyboard.
    const minimumThumb = screen.getByRole("slider", {
      name: "Minimum salary",
    });

    minimumThumb.focus();
    await user.keyboard("{ArrowRight}");

    // Moving the minimum thumb must not overwrite a larger manual maximum.
    expect(maximumInput.value).toBe("250000");

    await user.click(
      screen.getByRole("button", { name: /Apply salary range/i })
    );

    expect(onApply).toHaveBeenLastCalledWith(
      expect.objectContaining({
        maxSalary: "250000",
      })
    );
  });
});
