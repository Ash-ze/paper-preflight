import { sortPresets, validatePreset } from './core/presets';
import type { Preset } from './core/types';

// Every presets/*.json file is bundled automatically: adding a venue is a one-file PR.
const modules = import.meta.glob<Preset>(['../presets/*.json', '!../presets/schema.json'], {
  eager: true,
  import: 'default',
});

export const PRESETS: Preset[] = sortPresets(
  Object.entries(modules)
    .filter(([path, p]) => {
      const id = path.split('/').pop()!.replace(/\.json$/, '');
      const errs = validatePreset(p, id);
      if (errs.length) console.warn(`Ignoring invalid preset ${path}:`, errs);
      return errs.length === 0;
    })
    .map(([, p]) => p),
);
