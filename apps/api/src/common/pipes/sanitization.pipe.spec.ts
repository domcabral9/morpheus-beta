import { SanitizationPipe } from "./sanitization.pipe";

describe("SanitizationPipe", () => {
  const pipe = new SanitizationPipe();

  it("remove espaços nas pontas de uma string", () => {
    expect(pipe.transform("  ola mundo  ")).toBe("ola mundo");
  });

  it("remove caracteres de controle mas preserva tab/LF/CR", () => {
    const withControlChars = "texto\x00com\x07lixo\tmantendo\nquebras\r";
    expect(pipe.transform(withControlChars)).toBe("textocomlixo\tmantendo\nquebras");
  });

  it("sanitiza recursivamente objetos aninhados", () => {
    const input = { a: "  x  ", b: { c: "  y  " } };
    expect(pipe.transform(input)).toEqual({ a: "x", b: { c: "y" } });
  });

  it("sanitiza recursivamente arrays", () => {
    expect(pipe.transform(["  a  ", "  b  "])).toEqual(["a", "b"]);
  });

  it("não mexe em números, booleanos, null ou Date", () => {
    const date = new Date("2026-01-01");
    expect(pipe.transform(42)).toBe(42);
    expect(pipe.transform(true)).toBe(true);
    expect(pipe.transform(null)).toBe(null);
    expect(pipe.transform(date)).toBe(date);
  });
});
