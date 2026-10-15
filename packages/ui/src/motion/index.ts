// Motion and interaction islands (ADR-023, ADR-024). Every one is progressive: the server output
// is complete, visible and correct without JavaScript, and reduced motion removes the movement.
// Motion for React (`motion/react`) runs inside `LazyMotion` with `domAnimation`; load-time
// entrances that must start before hydration (the hero) are CSS keyframes instead.
// CountUp is deliberately not exported: only OutcomeStats may animate a figure, after its
// verification filter.
export {
  Reveal,
  RevealItem,
  type RevealDelay,
  type RevealItemEffect,
  type RevealItemProps,
  type RevealProps,
} from "./Reveal";
export { Carousel, type CarouselProps } from "./Carousel";
export { MotionPause, type MotionPauseProps } from "./MotionPause";
export { Parallax, type ParallaxProps } from "./Parallax";
export { ReplayOnHover, type ReplayOnHoverProps } from "./ReplayOnHover";
export { SettleText, type SettlePart, type SettleTextProps } from "./SettleText";
