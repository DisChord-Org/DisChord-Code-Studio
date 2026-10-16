import { supportServerUrl, websiteUrl } from "../../../../../utils/Links";

interface HelpLink {
    icon: string;
    label: string;
    url: string;
    // Used in the "could not open ..." error message.
    what: string;
}

export const helpLinks: HelpLink[] = [
    { icon: "bi bi-discord", label: "Servidor de soporte", url: supportServerUrl, what: "el servidor de soporte" },
    { icon: "bi bi-globe2", label: "Sitio web", url: websiteUrl, what: "el sitio web" },
];
