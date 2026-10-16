export type ToolbarButtonVariant = "default" | "run" | "stop";

export const toolbarButtonVariants: Record<ToolbarButtonVariant, string> = {
    run: "bg-green-500/10 text-green-400 hover:bg-green-500/20",
    stop: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
    default: "text-gray-400 hover:bg-white/5 hover:text-white"
};
