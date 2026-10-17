import { z } from "zod";

export const profileExperienceSchema = z
    .object({
        company_name: z
            .string()
            .trim()
            .min(1, "Company name is required.")
            .max(200, "Company name must be 200 characters or fewer."),
        job_role: z
            .string()
            .trim()
            .min(1, "Job role is required.")
            .max(200, "Job role must be 200 characters or fewer."),
        start_date: z.iso.date(),
        end_date: z.preprocess(
            (value) => {
                if (typeof value !== "string") return value;
                const trimmed = value.trim();
                return trimmed === "" ? null : trimmed;
            },
            z.iso.date().nullable().optional(),
        ),
        description: z.preprocess(
            (value) => {
                if (typeof value !== "string") return value;
                const trimmed = value.trim();
                return trimmed === "" ? null : trimmed;
            },
            z
                .string()
                .refine(
                    (value) => value.split(/\s+/).length <= 500,
                    "Description must be 500 words or fewer.",
                )
                .nullable()
                .optional(),
        ),
    })
    .refine(
        (data) =>
            data.end_date == null ||
            data.end_date >= data.start_date,
        {
            path: ["end_date"],
            message: "End date must be on or after the start date.",
        },
    );