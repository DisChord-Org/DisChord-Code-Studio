const msPerMinute = 60_000;
const minutesPerHour = 60;

export const formatTimeSpent = (ms: number): string => {
    const totalMinutes = Math.max(0, Math.floor(ms / msPerMinute));
    const hours = Math.floor(totalMinutes / minutesPerHour);
    const minutes = totalMinutes % minutesPerHour;
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
};
