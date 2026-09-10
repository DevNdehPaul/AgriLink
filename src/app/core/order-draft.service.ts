import { Injectable } from '@angular/core';
import { ProduceListing } from './models';

export interface BuyerOrderDraft {
  listing: ProduceListing;
  quantityKg: number;
  deliveryCity: string;
  deliveryAddress: string;
}

@Injectable({ providedIn: 'root' })
export class OrderDraftService {
  private readonly key = 'agrilink_buyer_order_draft';

  set(draft: BuyerOrderDraft): void { localStorage.setItem(this.key, JSON.stringify(draft)); }
  get(): BuyerOrderDraft | null {
    try { const raw = localStorage.getItem(this.key); return raw ? JSON.parse(raw) as BuyerOrderDraft : null; }
    catch { return null; }
  }
  clear(): void { localStorage.removeItem(this.key); }
}
