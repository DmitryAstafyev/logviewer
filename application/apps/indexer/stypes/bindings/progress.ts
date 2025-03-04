// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Severity } from "./error";

/**
 * Represents a notification about an event (including potential errors)
 * related to processing a specific log entry, if such data is available.
 */
export type Notification = { 
/**
 * The severity level of the event.
 */
severity: Severity, 
/**
 * The content or message describing the event.
 */
content: string, 
/**
 * The log entry number that triggered the event, if applicable.
 */
line: number | null, };

/**
 * Describes the progress of an operation.
 */
export type Progress = { "Ticks": Ticks } | { "Notification": Notification } | "Stopped";

/**
 * Provides detailed information about the progress of an operation.
 */
export type Ticks = { 
/**
 * The current progress count, typically representing `n` out of `100%`.
 */
count: number, 
/**
 * The name of the current progress stage, for user display purposes.
 */
state: string | null, 
/**
 * The total progress counter. Usually `100`, but for file operations,
 * it might represent the file size, where `count` indicates the number of bytes read.
 */
total: number | null | undefined, };
