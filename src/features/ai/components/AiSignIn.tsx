import { Button } from "../../../components/ui";
import type { AiAuth } from "../types";
import { AmayaIcon } from "./AmayaIcon";

interface AiSignInProps {
    auth: AiAuth;
    onLogin: () => void;
}

export const AiSignIn = ({ auth, onLogin }: AiSignInProps) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <AmayaIcon size={48} />
        {auth === "pending" ? (
            <>
                <p className="text-xs text-gray-400" role="status">Termina el inicio de sesión en tu navegador…</p>
                <Button variant="ghost" size="sm" onClick={onLogin}>Abrir de nuevo</Button>
            </>
        ) : auth === "checking" ? (
            <p className="text-xs text-gray-500" role="status">Comprobando la sesión…</p>
        ) : (
            <>
                <p className="text-xs text-gray-400">Inicia sesión con Discord para usar Amaya.</p>
                <Button size="sm" onClick={onLogin}>
                    <i className="bi bi-discord mr-1.5" aria-hidden="true"></i>
                    Iniciar sesión con Discord
                </Button>
            </>
        )}
    </div>
);
