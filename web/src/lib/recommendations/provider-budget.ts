import { z } from "zod";
import { askJevScores } from "@/lib/ai/jev";
import { createServiceClient } from "@/lib/supabase/service";
import type { AskJev } from "./job-fit";
import type { BuildRecommendationsOptions } from "./recommend";
import { groqComplete, type CompleteText } from "./summaries";

const PROVIDER_LEASE_SECONDS = 60;

type Provider = "jev" | "groq";

export function createBudgetedRecommendationProviders(
  userId: string,
  options: BuildRecommendationsOptions = {},
) {
  let budgetUnavailable = false;

  // Serialize Jev requests within this generation attempt.
  let jevQueue: Promise<void> = Promise.resolve();

  const baseAsk: AskJev = options.ask ?? askJevScores;
  const baseComplete: CompleteText = options.complete ?? groqComplete;

  async function withBudget<T>(
    provider: Provider,
    call: () => Promise<T>,
  ): Promise<T> {
    if (budgetUnavailable) {
      throw new Error("Recommendation provider budget is unavailable");
    }

    let service: ReturnType<typeof createServiceClient>;
    let token: string;

    try {
      service = createServiceClient();

      const { data, error } = await service.rpc(
        "reserve_recommendation_provider_call",
        {
          p_user_id: userId,
          p_provider: provider,
          p_lease_seconds: PROVIDER_LEASE_SECONDS,
        },
      );

      const parsedToken = z.uuid().safeParse(data);

      if (error || !parsedToken.success) {
        throw new Error("Provider reservation unavailable");
      }

      token = parsedToken.data;
    } catch {
      budgetUnavailable = true;
      throw new Error("Recommendation provider budget is unavailable");
    }

    try {
      return await call();
    } finally {
      try {
        const { data, error } = await service.rpc(
          "release_recommendation_provider_call",
          { p_token: token },
        );

        if (error || data !== true) {
          throw new Error("Provider reservation release failed");
        }
      } catch {
        budgetUnavailable = true;
        throw new Error(
          "Unable to release recommendation provider capacity",
        );
      }
    }
  }

  const ask: AskJev = (state, questions) => {
    const result = jevQueue.then(() =>
      withBudget("jev", () => baseAsk(state, questions)),
    );

    // Keep the queue usable after an ordinary provider failure.
    // The original result still rejects for its caller.
    jevQueue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };

  const complete: CompleteText = (messages) =>
    withBudget("groq", () => baseComplete(messages));

  function assertAvailable(): void {
    if (budgetUnavailable) {
      throw new Error("Recommendation provider budget is unavailable");
    }
  }

  return {
    options: {
      ...options,
      ask,
      complete,
    },
    assertAvailable,
  };
}