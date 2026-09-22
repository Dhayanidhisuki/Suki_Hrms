import { ThemeName } from "./theme";

export interface ThemeMeta {
  name: ThemeName;
  label: string;
  dot: string;
  buttonText: string;
  logo: string;
}

export const THEMES: Record<ThemeName, ThemeMeta> = {
  blue: {
    name: "blue",
    label: "Blue",
    dot: "#2090FF",
    buttonText: "Switch to Blue",
    logo: "/branding/suki-hrms-blue.svg",
  },
  green: {
    name: "green",
    label: "Green",
    dot: "#7f9e15",
    buttonText: "Switch to Green",
    logo: "/branding/suki-hrms-green.svg",
  },
  purple: {
    name: "purple",
    label: "Purple",
    dot: "#CD69ED",
    buttonText: "Switch to Purple",
    logo: "/branding/suki-hrms-purple.svg",
  },
  orange: {
    name: "orange",
    label: "Orange",
    dot: "#FF6901",
    buttonText: "Switch to Orange",
    logo: "/branding/suki-hrms-orange.svg",
  },
};
