import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

export type FapshiMedium = "mobile money" | "orange money";
export type FapshiPaymentStatus = "CREATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED";

interface MoneyRequestInput {
  amount: number;
  phone: string;
  medium?: FapshiMedium;
  name?: string;
  email?: string;
  userId: string;
  externalId: string;
  message: string;
}
interface ProviderAcceptedResponse { message: string; transId: string; dateInitiated: string; }
export interface PaymentStatusResponse {
  transId: string;
  status: FapshiPaymentStatus;
  medium?: string;
  transType?: string;
  amount: number;
  externalId?: string;
  userId?: string;
  financialTransId?: string;
  dateInitiated?: string;
  dateConfirmed?: string;
}

class FapshiClient {
  private collectionHeaders(): Record<string, string> {
    return { apiuser: env.FAPSHI_API_USER, apikey: env.FAPSHI_API_KEY, "Content-Type": "application/json" };
  }

  private payoutHeaders(): Record<string, string> {
    if (!env.FAPSHI_PAYOUT_API_USER || !env.FAPSHI_PAYOUT_API_KEY) {
      throw new AppError("Fapshi payout service credentials are not configured", 503);
    }
    return { apiuser: env.FAPSHI_PAYOUT_API_USER, apikey: env.FAPSHI_PAYOUT_API_KEY, "Content-Type": "application/json" };
  }

  private body(input: MoneyRequestInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
      amount: input.amount, phone: input.phone, userId: input.userId,
      externalId: input.externalId, message: input.message,
    };
    if (input.medium !== undefined) body.medium = input.medium;
    if (input.name !== undefined) body.name = input.name;
    if (input.email !== undefined) body.email = input.email;
    return body;
  }

  async directPay(input: MoneyRequestInput): Promise<ProviderAcceptedResponse> {
    return this.post("/direct-pay", input, this.collectionHeaders(), "Fapshi rejected the direct payment request");
  }

  async payout(input: MoneyRequestInput): Promise<ProviderAcceptedResponse> {
    return this.post("/payout", input, this.payoutHeaders(), "Fapshi rejected the payout request");
  }

  private async post(path: string, input: MoneyRequestInput, headers: Record<string, string>, fallback: string): Promise<ProviderAcceptedResponse> {
    let response: Response;
    try {
      response = await fetch(`${env.FAPSHI_BASE_URL}${path}`, {
        method: "POST", headers, body: JSON.stringify(this.body(input)), signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError("Unable to reach payment provider", 502);
    }
    const payload = (await response.json().catch(() => ({}))) as Partial<ProviderAcceptedResponse> & { message?: string };
    if (!response.ok || !payload.transId) throw new AppError(payload.message ?? fallback, 502);
    return payload as ProviderAcceptedResponse;
  }

  async getPaymentStatus(transId: string): Promise<PaymentStatusResponse> {
    return this.status(transId, this.collectionHeaders());
  }

  async getPayoutStatus(transId: string): Promise<PaymentStatusResponse> {
    return this.status(transId, this.payoutHeaders());
  }

  private async status(transId: string, headers: Record<string, string>): Promise<PaymentStatusResponse> {
    let response: Response;
    try {
      response = await fetch(`${env.FAPSHI_BASE_URL}/payment-status/${encodeURIComponent(transId)}`, {
        method: "GET", headers, signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AppError("Unable to reach payment provider", 502);
    }
    const payload = (await response.json().catch(() => ({}))) as PaymentStatusResponse | { message?: string };
    if (!response.ok || !("transId" in payload)) {
      throw new AppError("message" in payload && payload.message ? payload.message : "Unable to verify payment status", 502);
    }
    return payload;
  }
}
export const fapshiClient = new FapshiClient();
