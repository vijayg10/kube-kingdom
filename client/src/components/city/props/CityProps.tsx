import { useMemo } from 'react';
import type { DecorItem } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';
import { modelManifest } from '../../../render/modelManifest';
import { GltfModel } from '../models/GltfModel';
import { ModelOrFallback } from '../models/ModelOrFallback';

/**
 * Renders medieval decor props (wells, market stands, barrels, fences, bonfires,
 * rocks, hay) from the converted Quaternius pack. Cloned per placement, hidden
 * at far LOD. Only active when real models are enabled.
 */
const MODEL_BASE = '/models/medieval';

export function CityProps({ decor }: { decor: DecorItem[] }) {
  const lod = useLOD();

  // Group by model so each GLB loads once; render clones at each placement.
  const byModel = useMemo(() => {
    const m = new Map<string, DecorItem[]>();
    for (const d of decor) {
      const arr = m.get(d.model) ?? [];
      arr.push(d);
      m.set(d.model, arr);
    }
    return m;
  }, [decor]);

  if (!modelManifest.enabled || lod === 'far' || decor.length === 0) return null;

  return (
    <ModelOrFallback fallback={null}>
      {[...byModel.entries()].map(([model, items]) => (
        <group key={model}>
          {items.map((d, i) => (
            <GltfModel
              key={i}
              url={`${MODEL_BASE}/${model}.glb`}
              position={d.position}
              scale={d.scale}
              rotationY={d.rotationY}
            />
          ))}
        </group>
      ))}
    </ModelOrFallback>
  );
}

export default CityProps;
