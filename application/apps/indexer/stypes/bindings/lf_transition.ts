// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Ticks } from "./progress";

/**
 * Describes the progress of an operation.
 */
export type LifecycleTransition = { "Started": { 
/**
 * The unique identifier of the operation.
 */
uuid: string, 
/**
 * A user-friendly name of the operation for display purposes.
 */
alias: string, } } | { "Ticks": { 
/**
 * The unique identifier of the operation.
 */
uuid: string, 
/**
 * The progress data associated with the operation.
 */
ticks: Ticks, } } | { "Stopped": string };