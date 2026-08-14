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
    findUsersByPermission: jest.Mock;
    findForUser: jest.Mock;
    markAsRead: jest.Mock;
    countUnread: jest.Mock;
    markAllAsRead: jest.Mock;
  };
  let emailAdapter: { send: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockResolvedValue({ id: "notif-1" }),
      findUserContact: jest
        .fn()
        .mockResolvedValue({ id: "user-1", name: "Ana", email: "ana@example.com", isActive: true }),
      findUsersByRole: jest.fn(),
      findUsersByPermission: jest.fn(),
      findForUser: jest.fn(),
      markAsRead: jest.fn(),
      countUnread: jest.fn(),
      markAllAsRead: jest.fn(),
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
      data: { softwareName: "Excel", stepName: "Aprovação jurídica" },
    };

    it("grava a notificação (type+data) e envia e-mail renderizado para um usuário ativo", async () => {
      await service.notify(input);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", type: "NEW_REQUEST", data: input.data }),
      );
      expect(emailAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "ana@example.com",
          subject: expect.stringContaining("Excel"),
        }),
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
        data: { softwareName: "Excel", stepName: "Nova etapa" },
      });

      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-2" }));
    });

    it("não faz nada se ninguém tiver o papel", async () => {
      repo.findUsersByRole.mockResolvedValue([]);
      await service.notifyRole("tenant-1", "role-1", {
        type: "NEW_REQUEST",
        data: { softwareName: "X", stepName: "Y" },
      });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("notifyPermissionHolders", () => {
    it("notifica todo usuário ativo que tenha a permissão, com dedupe do repository", async () => {
      repo.findUsersByPermission.mockResolvedValue([
        { id: "user-1", name: "Ana", email: "ana@example.com" },
      ]);
      repo.findUserContact.mockResolvedValue({
        id: "user-1",
        name: "Ana",
        email: "ana@example.com",
        isActive: true,
      });

      await service.notifyPermissionHolders("tenant-1", "assessments:approve", {
        type: "INVENTORY_APPROVAL_REQUESTED",
        data: { itemName: "Legacy ERP" },
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INVENTORY_APPROVAL_REQUESTED" }),
      );
    });
  });

  describe("countUnread", () => {
    it("delega ao repository", async () => {
      repo.countUnread.mockResolvedValue(3);
      await expect(service.countUnread("user-1")).resolves.toBe(3);
      expect(repo.countUnread).toHaveBeenCalledWith("user-1");
    });
  });

  describe("markAllAsRead", () => {
    it("delega ao repository", async () => {
      repo.markAllAsRead.mockResolvedValue({ count: 5 });
      await expect(service.markAllAsRead("user-1")).resolves.toEqual({ count: 5 });
      expect(repo.markAllAsRead).toHaveBeenCalledWith("user-1");
    });
  });
});
