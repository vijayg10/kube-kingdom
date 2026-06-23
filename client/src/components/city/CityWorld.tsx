import { useCityLayout } from '../../hooks/useCityLayout';
import { LodController } from '../../hooks/useLOD';
import { Terrain } from './Terrain';
import { Districts } from './District';
import { Roads } from './Road';
import { NodeBuilding } from './NodeBuilding';
import { PodHouse } from './PodHouse';
import { PodEffects } from './effects/PodEffects';
import { Traffic } from './Traffic';
import { Incident } from './effects/Incident';
import { Trees } from './props/Trees';
import { GroundCover } from './props/GroundCover';
import { Lamps } from './props/Lamps';
import { CityProps } from './props/CityProps';
import { CityGates } from './extended/CityGate';
import { Interchange } from './extended/Interchange';
import { StatefulHouses } from './extended/StatefulHouses';
import { Watchtower } from './extended/Watchtower';
import { Merchant } from './extended/Merchant';
import { Warehouse } from './extended/Warehouse';
import { ConfigInfra } from './extended/ConfigInfra';
import { Vault } from './extended/Vault';
import { Foreman } from './extended/Foreman';
import { Atmosphere } from './effects/Atmosphere';

/**
 * Assembles all city layers from the computed layout. Mounted inside CityScene
 * after Check-In Gate 1. LOD gating lives inside each layer component.
 */
export function CityWorld() {
  const layout = useCityLayout();
  return (
    <>
      <LodController />
      <Terrain terrain={layout.terrain} />
      <Districts districts={layout.districts} />
      <Trees positions={layout.props.trees} />
      <GroundCover positions={layout.props.groundCover} />
      <Lamps positions={layout.props.lamps} />
      <CityProps decor={layout.props.decor} />
      <Roads roads={layout.roads} buildings={layout.buildings} />
      <NodeBuilding buildings={layout.buildings} />
      <PodHouse buildings={layout.buildings} />
      <PodEffects buildings={layout.buildings} />
      <Traffic roads={layout.roads} buildings={layout.buildings} />
      <Incident roads={layout.roads} buildings={layout.buildings} />
      {/* US6 extended resources */}
      <CityGates buildings={layout.buildings} />
      <Interchange buildings={layout.buildings} />
      <StatefulHouses buildings={layout.buildings} />
      <Watchtower buildings={layout.buildings} />
      <Merchant buildings={layout.buildings} />
      <Warehouse buildings={layout.buildings} />
      <ConfigInfra buildings={layout.buildings} />
      <Vault buildings={layout.buildings} />
      <Foreman buildings={layout.buildings} />
      <Atmosphere buildings={layout.buildings} />
    </>
  );
}

export default CityWorld;
