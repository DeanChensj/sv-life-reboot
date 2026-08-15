import type { GameEvent } from '../../types';
import { initializationEvents } from './initialization';
import { careerEvents } from './career';
import { immigrationEvents } from './immigration';
import { startupEvents } from './startup';
import { tradingEvents } from './trading';
import { lifestyleEvents } from './lifestyle';
import { housingFinanceEvents } from './housingFinance';
import { macroNewsEvents } from './macroNews';
import { settlementEvents } from './settlement';
import { companyEvents } from './companyEvents';

export * from './helpers';

export const events: Record<string, GameEvent> = {
  ...initializationEvents,
  ...careerEvents,
  ...companyEvents,
  ...immigrationEvents,
  ...startupEvents,
  ...tradingEvents,
  ...lifestyleEvents,
  ...housingFinanceEvents,
  ...macroNewsEvents,
  ...settlementEvents,
};

export const EVENTS = events;
