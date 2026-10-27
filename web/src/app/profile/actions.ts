"use server";
import { updateCurrentProfile } from "@/lib/profiles/profile";

export async function saveProfile(input: unknown) {
    return await updateCurrentProfile(input);
}