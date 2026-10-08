import type { Lang, Messages } from "../index";
import { en as enCore } from "./en";
import { ar as arCore } from "./ar";
import { moduleMessages } from "./modules";

export const en: Messages = { ...enCore, ...moduleMessages("en") };
export const ar: Messages = { ...arCore, ...moduleMessages("ar") };

export const DICTIONARIES: Record<Lang, Messages> = { en, ar };

export type { ModuleMessages } from "./modules";
