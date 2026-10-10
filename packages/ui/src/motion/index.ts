// Motion and interaction islands ported from the owner comp (ADR-023). Every one is progressive:
// the server output is complete and correct without JavaScript, and reduced motion disables the
// movement. CountUp is deliberately not exported: only OutcomeStats may animate a figure, after
// its verification filter.
export { Reveal, type RevealDelay, type RevealProps } from "./Reveal";
export { RevealController } from "./RevealController";
export { Carousel, type CarouselProps } from "./Carousel";
