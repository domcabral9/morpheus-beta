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

  it("preserva Buffer intacto, mesmo aninhado (ex.: file.buffer de um upload)", () => {
    const buffer = Buffer.from([137, 80, 78, 71]);
    expect(pipe.transform(buffer)).toBe(buffer);

    const file = { fieldname: "  file  ", buffer, mimetype: "image/png" };
    const result = pipe.transform(file) as typeof file;
    expect(result.fieldname).toBe("file");
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer).toBe(buffer);
  });
});
