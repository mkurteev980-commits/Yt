import React from "react";
import { Composition } from "remotion";
import { CometShort, COMET_FRAMES } from "./videos/comet/Comet";
import { TestBox } from "./Test";
export const Root: React.FC = () => (
  <>
  <Composition id="TestBox" component={TestBox} durationInFrames={30} fps={30} width={1080} height={1920} />
  <Composition id="CometShort" component={CometShort} durationInFrames={COMET_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
