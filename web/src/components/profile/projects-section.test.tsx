// @vitest-environment jsdom

/**
 * Tests the Projects section on the profile page: listing projects and links,
 * adding, editing, deleting projects, and adding/removing links.
 * The server actions are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsSection, type ProjectEntry } from "./projects-section";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getImageUrl: vi.fn(),
  addProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  addLink: vi.fn(),
  deleteLink: vi.fn(),
}));

vi.mock("@/app/profile/projects-actions", () => ({
  addProject: mocks.addProject,
  updateProject: mocks.updateProject,
  deleteProject: mocks.deleteProject,
  addLink: mocks.addLink,
  deleteLink: mocks.deleteLink,
  getImageUrl: mocks.getImageUrl,
}));

const careerConnect: ProjectEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CareerConnect",
  short_description: "Job search and application tracking platform.",
  links: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      label: "GitHub",
      url: "https://github.com/Ionnerss/CareerConnect",
    },
  ],
  images: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      url: "https://example.supabase.co/signed/careerconnect.png",
      alt_text: "Dashboard screenshot",
    },
  ],
};

const portfolio: ProjectEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Portfolio",
  short_description: "Personal website.",
  links: [],
  images: [],
};

describe("ProjectsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lists projects with their links", () => {
    render(<ProjectsSection initialProjects={[careerConnect, portfolio]} />);

    const project = screen.getByRole("listitem", { name: "CareerConnect" });
    expect(within(project).getByText("Job search and application tracking platform.")).toBeDefined();

    const link = within(project).getByRole<HTMLAnchorElement>("link", { name: "GitHub" });
    expect(link.href).toBe("https://github.com/Ionnerss/CareerConnect");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");

    expect(screen.getByRole("listitem", { name: "Portfolio" })).toBeDefined();
  });

  it("shows a message when there are no projects yet", () => {
    render(<ProjectsSection initialProjects={[]} />);

    expect(screen.getByText("No projects added yet.")).toBeDefined();
  });

  it("shows the load error from the server", () => {
    render(
      <ProjectsSection
        initialProjects={[]}
        loadError="Unable to load your projects. Please try again."
      />,
    );

    expect(screen.getByText("Unable to load your projects. Please try again.")).toBeDefined();
  });

  it("adds a new project", async () => {
    const user = userEvent.setup();
    mocks.addProject.mockResolvedValue({
      success: true,
      project: {
        id: portfolio.id,
        profile_id: "user-1",
        name: "Portfolio",
        short_description: "Personal website.",
        created_at: "2026-10-18T00:00:00Z",
      },
    });

    render(<ProjectsSection initialProjects={[]} />);

    await user.click(screen.getByRole("button", { name: "Add project" }));
    await user.type(screen.getByLabelText("Project name"), "Portfolio");
    await user.type(screen.getByLabelText("Short description"), "Personal website.");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Project added.")).toBeDefined();
    expect(screen.getByRole("listitem", { name: "Portfolio" })).toBeDefined();
    expect(mocks.addProject).toHaveBeenCalledWith({
      name: "Portfolio",
      short_description: "Personal website.",
    });
  });

  it("does not save a project without a name and description", async () => {
    const user = userEvent.setup();
    render(<ProjectsSection initialProjects={[]} />);

    await user.click(screen.getByRole("button", { name: "Add project" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Project name is required (max 150 characters).")).toBeDefined();
    expect(screen.getByText("Description is required (max 500 characters).")).toBeDefined();
    expect(mocks.addProject).not.toHaveBeenCalled();
  });

  it("edits a project and keeps its links", async () => {
    const user = userEvent.setup();
    mocks.updateProject.mockResolvedValue({
      success: true,
      project: {
        id: careerConnect.id,
        name: "CareerConnect",
        short_description: "SOEN 341 team project.",
      },
    });

    render(<ProjectsSection initialProjects={[careerConnect]} />);

    await user.click(screen.getByRole("button", { name: "Edit CareerConnect" }));
    const description = screen.getByLabelText("Short description");
    await user.clear(description);
    await user.type(description, "SOEN 341 team project.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Project updated.")).toBeDefined();
    expect(screen.getByText("SOEN 341 team project.")).toBeDefined();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeDefined();
    expect(mocks.updateProject).toHaveBeenCalledWith(careerConnect.id, {
      name: "CareerConnect",
      short_description: "SOEN 341 team project.",
    });
  });

  it("shows the server error when saving fails", async () => {
    const user = userEvent.setup();
    mocks.updateProject.mockResolvedValue({
      success: false,
      error: "Unable to update your project. Please try again.",
    });

    render(<ProjectsSection initialProjects={[portfolio]} />);

    await user.click(screen.getByRole("button", { name: "Edit Portfolio" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Unable to update your project. Please try again."),
    ).toBeDefined();
    expect(screen.getByLabelText("Project name")).toBeDefined();
  });

  it("deletes a project after confirmation", async () => {
    const user = userEvent.setup();
    mocks.deleteProject.mockResolvedValue({
      success: true,
      projectId: portfolio.id,
      cleanupPending: false,
    });

    render(<ProjectsSection initialProjects={[careerConnect, portfolio]} />);

    await user.click(screen.getByRole("button", { name: "Delete Portfolio" }));
    expect(mocks.deleteProject).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete Portfolio" }));

    expect(await screen.findByText("Project removed.")).toBeDefined();
    expect(screen.queryByRole("listitem", { name: "Portfolio" })).toBeNull();
    expect(mocks.deleteProject).toHaveBeenCalledWith(portfolio.id);
  });

  it("adds a link to a project", async () => {
    const user = userEvent.setup();
    mocks.addLink.mockResolvedValue({
      success: true,
      link: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        project_id: portfolio.id,
        label: "Live site",
        url: "https://ray.dev",
        created_at: "2026-10-18T00:00:00Z",
      },
    });

    render(<ProjectsSection initialProjects={[portfolio]} />);

    await user.click(screen.getByRole("button", { name: "Add link to Portfolio" }));
    await user.type(screen.getByLabelText("Link label"), "Live site");
    await user.type(screen.getByLabelText("URL"), "https://ray.dev");
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(await screen.findByText("Link added.")).toBeDefined();
    const link = screen.getByRole<HTMLAnchorElement>("link", { name: "Live site" });
    expect(link.href).toBe("https://ray.dev/");
    expect(mocks.addLink).toHaveBeenCalledWith(portfolio.id, {
      label: "Live site",
      url: "https://ray.dev",
    });
  });

  it("does not save a link with an invalid URL", async () => {
    const user = userEvent.setup();
    render(<ProjectsSection initialProjects={[portfolio]} />);

    await user.click(screen.getByRole("button", { name: "Add link to Portfolio" }));
    await user.type(screen.getByLabelText("Link label"), "Live site");
    await user.type(screen.getByLabelText("URL"), "ray.dev");
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(
      screen.getByText("Enter a valid URL starting with http:// or https://."),
    ).toBeDefined();
    expect(mocks.addLink).not.toHaveBeenCalled();
  });

  it("removes a link", async () => {
    const user = userEvent.setup();
    mocks.deleteLink.mockResolvedValue({
      success: true,
      linkId: careerConnect.links[0].id,
    });

    render(<ProjectsSection initialProjects={[careerConnect]} />);

    await user.click(screen.getByRole("button", { name: "Remove link GitHub" }));

    expect(await screen.findByText("Link removed.")).toBeDefined();
    expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
    expect(mocks.deleteLink).toHaveBeenCalledWith(careerConnect.links[0].id);
  });

  it("shows project images", () => {
    render(<ProjectsSection initialProjects={[careerConnect]} />);

    const image = screen.getByRole<HTMLImageElement>("img", { name: "Dashboard screenshot" });
    expect(image.src).toBe("https://example.supabase.co/signed/careerconnect.png");
  });

  it("uploads an image to a project", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        image: {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          project_id: portfolio.id,
          storage_path: "user-1/project/new.png",
          alt_text: null,
        },
      }),
    });
    mocks.getImageUrl.mockResolvedValue({
      success: true,
      imageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      alt_text: null,
      url: "https://example.supabase.co/signed/new.png",
      expiresIn: 60,
    });

    render(<ProjectsSection initialProjects={[portfolio]} />);

    const file = new File(["image"], "shot.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Add image to Portfolio"), file);

    expect(await screen.findByText("Image added.")).toBeDefined();
    const image = screen.getByRole<HTMLImageElement>("img", { name: "Portfolio screenshot 1" });
    expect(image.src).toBe("https://example.supabase.co/signed/new.png");

    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("/api/project-images");
    expect(options.method).toBe("POST");
    expect((options.body as FormData).get("projectId")).toBe(portfolio.id);
  });

  it("rejects an image that is too large before uploading", async () => {
    const user = userEvent.setup();
    render(<ProjectsSection initialProjects={[portfolio]} />);

    const file = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    await user.upload(screen.getByLabelText("Add image to Portfolio"), file);

    expect(
      screen.getByText("Please choose a JPEG, PNG, or WebP image of 5 MB or smaller."),
    ).toBeDefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("removes an image", async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        imageId: careerConnect.images[0].id,
        cleanupPending: false,
      }),
    });

    render(<ProjectsSection initialProjects={[careerConnect]} />);

    await user.click(screen.getByRole("button", { name: "Remove image 1 from CareerConnect" }));

    expect(await screen.findByText("Image removed.")).toBeDefined();
    expect(screen.queryByRole("img", { name: "Dashboard screenshot" })).toBeNull();

    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("/api/project-images");
    expect(options.method).toBe("DELETE");
    expect(JSON.parse(options.body as string)).toEqual({ imageId: careerConnect.images[0].id });
  });
});
