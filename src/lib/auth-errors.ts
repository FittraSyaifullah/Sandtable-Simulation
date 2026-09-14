import { AuthApiError } from "@supabase/supabase-js";

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.status === 400) return "Check your email and password, then try again.";
    if (error.status === 429) return "Too many attempts. Please wait a moment before trying again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Authentication is temporarily unavailable.";
}
