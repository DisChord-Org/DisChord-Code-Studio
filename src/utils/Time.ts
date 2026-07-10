export const formatRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInSeconds < 120) return "Ahora mismo";
    if (diffInMinutes < 5) return "Hace un momento";
    if (diffInMinutes < 30) return "Hace cinco minutos";
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} minutos`;

    if (diffInHours >= 1 && diffInHours <= 5) {
        return diffInHours === 1 ? "Hace 1 hora" : `Hace ${diffInHours} horas`;
    }

    const isToday = now.toDateString() === then.toDateString();
    if (isToday && diffInHours > 5) return "Hoy";

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === then.toDateString()) return "Ayer";

    return then.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};