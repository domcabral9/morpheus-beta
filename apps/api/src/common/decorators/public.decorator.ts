import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Isenta uma rota (ou controller inteiro) do JwtAuthGuard global. Protegido
 * por padrão é a postura correta para um sistema corporativo — rotas ficam
 * públicas só quando explicitamente marcadas, nunca por esquecimento de um
 * guard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
