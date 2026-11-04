const askAmayaEvent = "dischord-ask-amaya";

export const askAmaya = (text: string) => {
    window.dispatchEvent(new CustomEvent<{ text: string }>(askAmayaEvent, { detail: { text } }));
};

export const onAskAmaya = (handler: (text: string) => void) => {
    const listener = (event: Event) => handler((event as CustomEvent<{ text: string }>).detail.text);
    window.addEventListener(askAmayaEvent, listener);
    return () => window.removeEventListener(askAmayaEvent, listener);
};
