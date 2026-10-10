"use server";
import { updateCurrentProfile } from "@/lib/profile";

export async function saveProfile(input: unknown) {
    return await updateCurrentProfile(input);
}