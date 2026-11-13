import type { StadiumConfig } from '../data/types';
import { fourStandsExample } from './examples/fourStands.ts';
import { stadiumConfig } from './stadiumConfig.ts';

/** Configs the data plugin can build, chosen with STADIUM_CONFIG=<name>. Add real venues here. */
export const stadiumConfigs: Record<string, StadiumConfig> = {
  default: stadiumConfig,
  'four-stands': fourStandsExample,
};
