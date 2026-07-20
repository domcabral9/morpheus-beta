import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { CsrfGuard, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf.guard";

function makeContext(cookies: Record<string, string>, headers: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ cookies, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe("CsrfGuard", () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard();
  });

  it("permite quando cookie e header batem", () => {
    const context = makeContext(
      { [CSRF_COOKIE_NAME]: "token-abc" },
      { [CSRF_HEADER_NAME]: "token-abc" },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejeita quando o cookie está ausente", () => {
    const context = makeContext({}, { [CSRF_HEADER_NAME]: "token-abc" });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejeita quando o header está ausente", () => {
    const context = makeContext({ [CSRF_COOKIE_NAME]: "token-abc" }, {});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejeita quando cookie e header divergem", () => {
    const context = makeContext(
      { [CSRF_COOKIE_NAME]: "token-abc" },
      { [CSRF_HEADER_NAME]: "token-diferente" },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejeita quando os valores têm tamanhos diferentes", () => {
    const context = makeContext({ [CSRF_COOKIE_NAME]: "abc" }, { [CSRF_HEADER_NAME]: "abcdef" });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
