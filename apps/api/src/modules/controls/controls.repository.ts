import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const frameworkWithCountInclude = {
  _count: { select: { controls: true } },
} satisfies Prisma.ControlFrameworkInclude;

export type ControlFrameworkWithCount = Prisma.ControlFrameworkGetPayload<{
  include: typeof frameworkWithCountInclude;
}>;

const controlDetailInclude = {
  framework: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ControlInclude;

export type ControlDetail = Prisma.ControlGetPayload<{
  include: typeof controlDetailInclude;
}>;

/**
 * Catálogo global de frameworks/controles (ISO, NIST, CIS, LGPD, GDPR, OWASP)
 * — não é tenant-scoped: representa capacidades do sistema, mesmo conteúdo
 * para qualquer tenant, como o catálogo de Permission.
 */
@Injectable()
export class ControlsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findFrameworks(): Promise<ControlFrameworkWithCount[]> {
    return this.prisma.controlFramework.findMany({
      include: frameworkWithCountInclude,
      orderBy: { name: "asc" },
    });
  }

  findControls(frameworkId?: string): Promise<ControlDetail[]> {
    return this.prisma.control.findMany({
      where: frameworkId ? { frameworkId } : undefined,
      include: controlDetailInclude,
      orderBy: [{ frameworkId: "asc" }, { code: "asc" }],
    });
  }

  findControlById(id: string): Promise<ControlDetail | null> {
    return this.prisma.control.findUnique({ where: { id }, include: controlDetailInclude });
  }
}
