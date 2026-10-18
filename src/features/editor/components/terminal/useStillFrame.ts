import { useEffect, useState } from "react";

/** The first frame of an image as a still picture (an animated GIF keeps repainting the panel behind it). */
export const useStillFrame = (url: string | null, needed: boolean): string | null => {
    const [still, setStill] = useState<string | null>(null);

    useEffect(() => {
        setStill(null);
        if (!url || !needed) return;

        let cancelled = false;
        let created: string | null = null;
        const image = new Image();
        image.src = url;

        image
            .decode()
            .then(() => {
                const canvas = document.createElement("canvas");
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                canvas.getContext("2d")?.drawImage(image, 0, 0);
                canvas.toBlob((blob) => {
                    if (!blob) return;
                    created = URL.createObjectURL(blob);
                    if (cancelled) URL.revokeObjectURL(created);
                    else setStill(created);
                });
            })
            .catch(() => {}); // Decorative frame: without it the terminal just shows no still image.

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [url, needed]);

    return still;
};
