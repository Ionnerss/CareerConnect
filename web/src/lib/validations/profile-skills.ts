import { z } from "zod";

export const profileSkillSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Skill name is required.")
        .max(100, "Skill name must be 100 characters or fewer."),

    proficiency: z.enum([
        "Beginner",
        "Intermediate",
        "Advanced",
        "Expert",
    ]),
});