import { formatTimeSpent } from "./format";
import { useProjectTime } from "./timeStore";

/** The time spent in a project, with a clock icon. */
export const ProjectTime = ({ name }: { name: string }) => (
    <span className="inline-flex items-center gap-1">
        <i className="bi bi-clock" aria-hidden="true"></i>
        {formatTimeSpent(useProjectTime(name))}
    </span>
);
