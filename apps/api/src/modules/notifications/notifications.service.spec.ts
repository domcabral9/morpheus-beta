import { Test } from "@nestjs/testing";
import { NotificationsService } from "./notifications.service";
import { NotificationsRepository } from "./notifications.repository";
import { EMAIL_ADAPTER } from "./email.interface";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let repo: {
    create: jest.Mock;
    findUserContact: jest.Mock;
    findUsersByRole: jest.Mock;
    findForUser: jest.Mock;
    markAsRead: jest.Mock;
  };
  let emailAdapter: { send: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockResolvedValue({ id: "notif-1" }),
      findUserContact: jest
        .fn()
        .mockResolvedValue({ id: "user-1", name: "Ana", email: "ana@example.com", isActive: true }),
      findUsersByRole: jest.fn(),
      findForUser: jest.fn(),
      markAsRead: jest.fn(),
    };
    emailAdapter = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: repo },
        { provide: EMAIL_ADAPTER, useValue: emailAdapter },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe("notify", () => {
    const input = {
      tenantId: "tenant-1",
      userId: "user-1",
      type: "NEW_REQUEST" as const,
      title: "Título",
      body: "Corpo",
    };

    it("grava a notificação e envia e-mail para um usuário ativo", async () => {
      await service.notify(input);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
      expect(emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "ana@example.com", subject: "Título" }),
      );
    });

    it("não envia e-mail para usuário inativo", async () => {
      repo.findUserContact.mockResolvedValue({
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        isActive: false,
      });

      await service.notify(input);

      expect(emailAdapter.send).not.toHaveBeenCalled();
    });

    it("nunca lança, mesmo se o repository falhar", async () => {
      repo.create.mockRejectedValue(new Error("db indisponível"));
      await expect(service.notify(input)).resolves.toBeUndefined();
    });

    it("nunca lança, mesmo se o envio de e-mail falhar", async () => {
      emailAdapter.send.mockRejectedValue(new Error("smtp indisponível"));
      await expect(service.notify(input)).resolves.toBeUndefined();
    });
  });

  describe("notifyRole", () => {
    it("notifica todos os usuários que possuem o papel", async () => {
      repo.findUsersByRole.mockResolvedValue([
        { id: "user-1", name: "Ana", email: "ana@example.com" },
        { id: "user-2", name: "Beto", email: "beto@example.com" },
      ]);
      repo.findUserContact.mockImplementation((id: string) =>
        Promise.resolve({ id, name: id, email: `${id}@example.com`, isActive: true }),
      );

      await service.notifyRole("tenant-1", "role-1", {
        type: "NEW_REQUEST",
        title: "Nova etapa",
        body: "Corpo",
      });

      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-2" }));
    });

    it("não faz nada se ninguém tiver o papel", async () => {
      repo.findUsersByRole.mockResolvedValue([]);
      await service.notifyRole("tenant-1", "role-1", {
        type: "NEW_REQUEST",
        title: "X",
        body: "Y",
      });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });
});
