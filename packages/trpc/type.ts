import type { Operation } from '@trpc/client';

export interface Message {
  method: string;
  operation: Operation;
  id: string;
}
