import { describe, expect, it } from "vitest";
import { jobPostingSchema, parseSkillList } from "./job-posting";

const valid = {
  title: "  Junior Frontend Developer ",
  firm_name: "Acme Inc.",
  location: "Montreal, QC",
  work_mode: "Hybrid",
  employment_type: "Full-time",
  required_skills: "React, TypeScript, SQL",
  salary: "65000",
  experience: "2",
  description: "Build the CareerConnect web app with the team.",
};

function errorFor(input: Record<string, unknown>, field: string) {
  const result = jobPostingSchema.safeParse(input);
  if (result.success) return null;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message ?? null;
}

describe("parseSkillList", () => {
  it("trims, squeezes spaces and drops empty entries", () => {
    expect(parseSkillList("  React ,, Type   Script ,  ")).toEqual(["React", "Type Script"]);
  });

  it("removes repeated skills, ignoring case and keeping the first spelling", () => {
    expect(parseSkillList("React, SQL, react, sql")).toEqual(["React", "SQL"]);
  });
});

describe("jobPostingSchema", () => {
  it("accepts a full posting and converts the numbers", () => {
    expect(jobPostingSchema.parse(valid)).toEqual({
      title: "Junior Frontend Developer",
      firm_name: "Acme Inc.",
      location: "Montreal, QC",
      work_mode: "Hybrid",
      employment_type: "Full-time",
      required_skills: "React, TypeScript, SQL",
      salary: 65000,
      experience: 2,
      description: "Build the CareerConnect web app with the team.",
      status: "open",
    });
  });

  it("accepts closed as a status", () => {
    expect(jobPostingSchema.parse({ ...valid, status: "closed" }).status).toBe("closed");
  });

  it("rejects statuses the database does not allow", () => {
    expect(errorFor({ ...valid, status: "draft" }, "status")).toBe("Choose a status.");
    expect(errorFor({ ...valid, status: "published" }, "status")).toBe("Choose a status.");
  });

  it("treats empty salary and experience as not given", () => {
    const result = jobPostingSchema.parse({ ...valid, salary: "  ", experience: "" });

    expect(result.salary).toBeNull();
    expect(result.experience).toBeNull();
  });

  it("stores skills as one clean comma-separated string", () => {
    const result = jobPostingSchema.parse({ ...valid, required_skills: " sql ,React,,  SQL " });

    expect(result.required_skills).toBe("sql, React");
  });

  it("requires a title, company, location and description", () => {
    const blank = { ...valid, title: " ", firm_name: "", location: "", description: "" };

    expect(errorFor(blank, "title")).toBe("Job title is required.");
    expect(errorFor(blank, "firm_name")).toBe("Company name is required.");
    expect(errorFor(blank, "location")).toBe("Location is required.");
    expect(errorFor(blank, "description")).toBe("Description is required.");
  });

  it("rejects a title over 150 characters", () => {
    expect(errorFor({ ...valid, title: "a".repeat(151) }, "title")).toBe(
      "Job title must be 150 characters or fewer.",
    );
  });

  it("only accepts the work modes the database allows", () => {
    expect(errorFor({ ...valid, work_mode: "" }, "work_mode")).toBe("Choose a work mode.");
    expect(errorFor({ ...valid, work_mode: "remote" }, "work_mode")).toBe("Choose a work mode.");
  });

  it("needs at least one skill and at most 20", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Skill ${i}`).join(", ");

    expect(errorFor({ ...valid, required_skills: " , ," }, "required_skills")).toBe(
      "Add at least one required skill.",
    );
    expect(errorFor({ ...valid, required_skills: tooMany }, "required_skills")).toBe(
      "List at most 20 skills.",
    );
  });

  it("rejects a skill longer than 50 characters", () => {
    expect(errorFor({ ...valid, required_skills: `React, ${"x".repeat(51)}` }, "required_skills")).toBe(
      "Each skill must be 50 characters or fewer.",
    );
  });

  it("rejects salaries that are not positive numbers with at most two decimals", () => {
    expect(errorFor({ ...valid, salary: "lots" }, "salary")).not.toBeNull();
    expect(errorFor({ ...valid, salary: "-5" }, "salary")).not.toBeNull();
    expect(errorFor({ ...valid, salary: "100.123" }, "salary")).not.toBeNull();
    expect(errorFor({ ...valid, salary: "0" }, "salary")).toBe("Salary must be greater than zero.");
    expect(jobPostingSchema.parse({ ...valid, salary: "55000.50" }).salary).toBe(55000.5);
  });

  it("accepts 0 to 50 whole years of experience", () => {
    expect(jobPostingSchema.parse({ ...valid, experience: "0" }).experience).toBe(0);
    expect(errorFor({ ...valid, experience: "1.5" }, "experience")).toBe(
      "Enter years of experience as a whole number.",
    );
    expect(errorFor({ ...valid, experience: "51" }, "experience")).toBe(
      "Years of experience must be 50 or fewer.",
    );
  });

  it("only accepts supported employment types", () => {
    for (const type of [
      "Full-time",
      "Part-time",
      "Contract",
      "Internship",
    ]) {
      expect(
        jobPostingSchema.safeParse({
          ...valid,
          employment_type: type,
        }).success
      ).toBe(true);
    }

    for (const type of ["", "Temporary", "full-time"]) {
      expect(
        errorFor(
          { ...valid, employment_type: type },
          "employment_type"
        )
      ).toBe("Choose an employment type.");
    }

    expect(
      errorFor(
        { ...valid, employment_type: undefined },
        "employment_type"
      )
    ).toBe("Choose an employment type.");
  });
});
