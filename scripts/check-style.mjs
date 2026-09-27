#!/usr/bin/env node
/**
 * Checa o(s) arquivo(s) passados contra docs/style-guide.md deste repo.
 *
 * Em-dash e assinatura de autoria de IA bloqueiam (exit 1) - sao mecanicos,
 * sem falso positivo possivel. Contraste negativo redundante so avisa
 * (exit 0, lista candidatos) - e uma regra semantica (o teste pratico do
 * proprio guia decide caso a caso), um bloqueio automatico aqui teria alto
 * falso positivo (auditoria da sessao que criou este script: dezenas de
 * candidatos legitimos nos docs existentes pra cada violacao real).
 *
 * Uso direto: node scripts/check-style.mjs <arquivo...>
 * Uso como hook: node scripts/check-style.mjs --hook   (le o JSON de entrada
 * do hook pelo stdin, extrai o arquivo editado, roda só se for .md - ver
 * .claude/settings.json). Sem dependencia de jq de proposito (nao garantido
 * no PATH em todo ambiente que dispara o hook) - só Node.
 * Chamado tambem pelo CI (.github/workflows/style-check.yml). Mesmo script
 * (quase identico) existe em n8n-secops-automation/scripts/check-style.mjs -
 * repos pequenos, sem pacote compartilhado, mesma filosofia dos dois
 * projetos de nao adicionar custo/complexidade extra por uma dependencia.
 */

import { readFileSync, existsSync } from 'node:fs';

// docs/style-guide.md documenta os padroes banidos e por isso precisa citar
// exemplos literais deles (o proprio "—", "Co-authored-by" em prosa, "X (não
// só Y)" como exemplo de contraste redundante) - excluido das checagens,
// senao o guia nunca passaria na sua propria regra. docs/changelog/*.md e a
// "Unica excecao" ja documentada no proprio style-guide.md (notas internas
// de engenharia, nunca lidas por um avaliador externo).
const EXCLUDED_BASENAMES = new Set(['style-guide.md']);
function isExcluded(file) {
  const normalized = file.replace(/\\/g, '/');
  return EXCLUDED_BASENAMES.has(file.split(/[\\/]/).pop()) || normalized.includes('docs/changelog/');
}

// Denylist de termos locais (ex.: nome real do empregador) - nunca commitado.
// O checker precisa conhecer o termo pra achar, e o termo em si nao pode
// viver num arquivo publico sem violar a propria regra que protege (ver
// docs/style-guide.md, "Nunca nomear o empregador real").
const LOCAL_DENYLIST_PATH = '.claude/style-check-local.json';

function loadBannedTerms() {
  if (!existsSync(LOCAL_DENYLIST_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LOCAL_DENYLIST_PATH, 'utf8'));
    return Array.isArray(parsed.bannedTerms) ? parsed.bannedTerms : [];
  } catch {
    // Denylist local malformada nao deve travar o checker, so fica sem efeito.
    return [];
  }
}

function checkFiles(files) {
  const bannedTerms = loadBannedTerms();
  const hardViolations = [];
  const softCandidates = [];

  for (const file of files) {
    if (!existsSync(file)) continue;
    if (isExcluded(file)) continue;
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNo = idx + 1;

      if (line.includes('—')) {
        hardViolations.push(`${file}:${lineNo}: em-dash ("—") - usar ponto, virgula, dois-pontos ou parenteses`);
      }

      // Ancorado a inicio de linha (formato real de trailer git/rodape de
      // PR) - nao dispara quando um doc so MENCIONA "Co-authored-by" em
      // prosa/crase.
      if (/^co-authored-by:.*(claude|anthropic)/i.test(line) || /generated with \[?claude code/i.test(line)) {
        hardViolations.push(`${file}:${lineNo}: assinatura/trailer de autoria de IA - remover a linha`);
      }

      for (const term of bannedTerms) {
        if (term && line.includes(term)) {
          hardViolations.push(`${file}:${lineNo}: termo banido (denylist local) encontrado`);
        }
      }

      const parenNegation = line.match(/\([^)]*\b(não|nunca)\b[^)]*\)/gi);
      if (parenNegation) {
        for (const m of parenNegation) softCandidates.push(`${file}:${lineNo}: ${m.trim()}`);
      }
      const commaNegation = line.match(/,\s*(não|nunca)\s+\w+/gi);
      if (commaNegation) {
        for (const m of commaNegation) softCandidates.push(`${file}:${lineNo}: "...${m.trim()}"`);
      }
    });
  }

  return { hardViolations, softCandidates };
}

function report(files, hardViolations, softCandidates) {
  if (softCandidates.length > 0) {
    console.log(`AVISO: ${softCandidates.length} candidato(s) a contraste negativo redundante (docs/style-guide.md) - aplicar o teste pratico em cada um (remover a parte negada mentalmente: o leitor perde alguma informacao real?):`);
    for (const c of softCandidates) console.log(`  - ${c}`);
  }

  if (hardViolations.length > 0) {
    console.log(`BLOQUEADO: ${hardViolations.length} violacao(oes) de estilo:`);
    for (const v of hardViolations) console.log(`  - ${v}`);
    console.log(JSON.stringify({
      decision: 'block',
      reason: `Violacoes de docs/style-guide.md: ${hardViolations.join(' | ')}`,
    }));
    process.exit(1);
  }

  if (softCandidates.length > 0) {
    console.log(JSON.stringify({
      systemMessage: `${softCandidates.length} candidato(s) a contraste negativo redundante em ${files.join(', ')} - revisar contra docs/style-guide.md antes de considerar o texto pronto.`,
    }));
  }

  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function runAsHook() {
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // input do hook malformado nao deve travar a edicao
  }
  const filePath = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
  if (!filePath || !filePath.toLowerCase().endsWith('.md')) {
    process.exit(0);
  }
  const { hardViolations, softCandidates } = checkFiles([filePath]);
  report([filePath], hardViolations, softCandidates);
}

const args = process.argv.slice(2);
if (args[0] === '--hook') {
  runAsHook();
} else if (args.length === 0) {
  console.log('Nenhum arquivo passado, nada a checar.');
  process.exit(0);
} else {
  const { hardViolations, softCandidates } = checkFiles(args);
  report(args, hardViolations, softCandidates);
}
