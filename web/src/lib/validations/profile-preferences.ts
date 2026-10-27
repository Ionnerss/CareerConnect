import { z } from "zod";

const blankToNull = (value: unknown) => {
    if (value === null || value === undefined) return null;

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }

    return value;
};

const desiredSalarySchema = z.preprocess(
    (value) => {
        const normalized = blankToNull(value);

        if (typeof normalized === "number") {
            return Number.isFinite(normalized)
                ? normalized.toString()
                : normalized;
        }

        return normalized;
    },
    z
        .string()
        .regex(
            /^\d{1,10}(?:\.\d{1,2})?$/,
            "Enter a salary with at most two decimal places.",
        )
        .refine(
            (value) => Number(value) > 0,
            "Desired salary must be greater than zero.",
        )
        .transform(Number)
        .nullable(),
);

export const profilePreferencesSchema = z.object({
    desired_role: z.preprocess(
        blankToNull,
        z.string().min(1).max(150).nullable(),
    ),

    desired_position: z.preprocess(
        blankToNull,
        z
            .enum(["full_time", "part_time", "internship", "contract"])
            .nullable(),
    ),

    desired_salary: desiredSalarySchema,

    work_mode: z.preprocess(
        blankToNull,
        z
            .enum(["remote", "hybrid", "on_site", "no_preference"])
            .nullable(),
    ),
});

export const profilePreferenceLanguageSchema = z.object({
    name: z.string().trim().min(1).max(100),
});