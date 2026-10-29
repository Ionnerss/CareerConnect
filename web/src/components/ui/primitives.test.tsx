// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonVariants } from "./button";
import { Input } from "./input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";

afterEach(cleanup);

describe("shared primitive compatibility", () => {
  it("keeps native button form submission and disabled behavior", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const blocked = vi.fn();
    render(<form onSubmit={submit}><Button type="submit">Save</Button><Button disabled onClick={blocked}>Unavailable</Button></form>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(blocked).not.toHaveBeenCalled();
  });

  it("preserves render composition and buttonVariants link consumers", () => {
    render(<><Button nativeButton={false} render={<a href="/jobs" />}>Find jobs</Button><a href="/application-status" className={buttonVariants({size:"lg"})}>Track</a></>);
    expect(screen.getByRole("button", { name: "Find jobs" }).tagName).toBe("A");
    expect(screen.getByRole("button", { name: "Find jobs" }).getAttribute("href")).toBe("/jobs");
    expect(screen.getByRole("link", { name: "Track" }).getAttribute("href")).toBe("/application-status");
  });

  it("forwards input labels, form values, invalid and disabled states", async () => {
    const user = userEvent.setup();
    render(<form aria-label="Search"><label htmlFor="query">Query</label><Input id="query" name="q" aria-invalid="true" aria-describedby="query-error" /><p id="query-error">Enter a query</p><Input aria-label="Disabled" disabled defaultValue="fixed" /></form>);
    const input = screen.getByRole("textbox", { name: "Query" }) as HTMLInputElement;
    await user.type(input, "design");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("query-error");
    expect(new FormData(screen.getByRole("form", {name:"Search"}) as HTMLFormElement).get("q")).toBe("design");
    expect((screen.getByRole("textbox", {name:"Disabled"}) as HTMLInputElement).disabled).toBe(true);
  });

  it("keeps composed menu triggers, portals, keyboard selection and Escape focus return", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const {container} = render(<div><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" />}>Options</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={select}>View</DropdownMenuItem><DropdownMenuItem disabled>Unavailable</DropdownMenuItem><DropdownMenuItem>Rename</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>);
    const trigger = screen.getByRole("button", {name:"Options"});
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu");
    expect(container.contains(menu)).toBe(false);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledTimes(1);
  });
});
