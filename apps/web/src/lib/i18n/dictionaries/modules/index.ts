import type { Lang, Messages } from "../../index";
import { students } from "./students";
import { parents } from "./parents";
import { teachers } from "./teachers";
import { academics } from "./academics";
import { attendance } from "./attendance";
import { fees } from "./fees";
import { exams } from "./exams";
import { library } from "./library";
import { transport } from "./transport";
import { hr } from "./hr";
import { inventory } from "./inventory";
import { reports } from "./reports";
import { schools } from "./schools";

export interface ModuleMessages {
  en: Messages;
  ar: Messages;
}

export const modules: Record<string, ModuleMessages> = {
  students,
  parents,
  teachers,
  academics,
  attendance,
  fees,
  exams,
  library,
  transport,
  hr,
  inventory,
  reports,
  schools,
};

export function moduleMessages(lang: Lang): Messages {
  return Object.values(modules).reduce<Messages>(
    (acc, module) => ({ ...acc, ...module[lang] }),
    {}
  );
}
