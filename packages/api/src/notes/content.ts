import { boundedText } from "../text";

export const NOTE_MAX_CHARS = 100_000;

export const noteContent = boundedText(NOTE_MAX_CHARS);
