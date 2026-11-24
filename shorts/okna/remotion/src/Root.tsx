import { Composition } from 'remotion';
import { Okna, FPS, TOTAL } from './Okna';
export const Root = () => (
  <Composition id="Okna" component={Okna} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
