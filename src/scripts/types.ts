import type { Channel } from '../funnel/channel.js';
import type { CqObject } from '../funnel/types.js';

export interface Script {
  id: string;
  label: string;
  kinds: string[];
  mount(el: HTMLElement, channel: Channel): void;
  unmount?(): void;
  onObject?(obj: CqObject): void;
}
