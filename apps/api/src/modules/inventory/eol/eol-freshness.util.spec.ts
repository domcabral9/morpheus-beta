import { computeFreshness } from "./eol-freshness.util";

// Formato real da API do endoflife.date (`releases[]`), confirmado via
// GET https://endoflife.date/api/v1/products/python nesta sessão.
const PYTHON_CYCLES = [
  { name: "3.14", isEol: false, latest: { name: "3.14.7" } },
  { name: "3.13", isEol: false, latest: { name: "3.13.15" } },
  { name: "2.7", isEol: true, latest: { name: "2.7.18" } },
];

describe("computeFreshness", () => {
  it("devolve unknown sem versão do item", () => {
    expect(computeFreshness(null, PYTHON_CYCLES)).toBe("unknown");
    expect(computeFreshness("", PYTHON_CYCLES)).toBe("unknown");
  });

  it("devolve unknown sem catálogo (cycles não é array)", () => {
    expect(computeFreshness("3.14.7", null)).toBe("unknown");
    expect(computeFreshness("3.14.7", undefined)).toBe("unknown");
    expect(computeFreshness("3.14.7", "algo-invalido")).toBe("unknown");
  });

  it("versão bate exatamente com o latest do ciclo -> up-to-date", () => {
    expect(computeFreshness("3.14.7", PYTHON_CYCLES)).toBe("up-to-date");
  });

  it("versão pertence ao ciclo mas não é a mais recente do ciclo -> outdated", () => {
    expect(computeFreshness("3.14.3", PYTHON_CYCLES)).toBe("outdated");
  });

  it("ciclo já EOL -> outdated mesmo se a versão bate com o latest do ciclo morto", () => {
    expect(computeFreshness("2.7.18", PYTHON_CYCLES)).toBe("outdated");
  });

  it("versão sem nenhum ciclo correspondente -> unknown (nunca adivinha)", () => {
    expect(computeFreshness("9.9.9", PYTHON_CYCLES)).toBe("unknown");
  });

  it("não confunde ciclos com prefixo parecido (3.1 não deve bater com 3.14.7)", () => {
    const cycles = [{ name: "3.1", isEol: false, latest: { name: "3.1.5" } }, ...PYTHON_CYCLES];
    expect(computeFreshness("3.14.7", cycles)).toBe("up-to-date");
  });

  it("ignora entradas malformadas dentro do array sem quebrar", () => {
    const cycles = [{ garbage: true }, ...PYTHON_CYCLES];
    expect(computeFreshness("3.14.7", cycles)).toBe("up-to-date");
  });
});
