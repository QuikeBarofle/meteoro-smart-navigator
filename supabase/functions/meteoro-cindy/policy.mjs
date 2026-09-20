// Shared, deterministic rules. No credentials, customer data or API calls.
export const POLICY_VERSION = '2026-09-20.1';
export const MISSING = 'No puedo confirmar esta información con los documentos actualmente disponibles.';
export const CATEGORY_DEFINITIONS = Object.freeze({
  'NO CALIFICA': 'No cumple un requisito de elegibilidad documentado para la solicitud concreta. No equivale automáticamente a una exclusión.',
  PREEXISTENCIA: 'Condición que cumple la definición de preexistencia del contrato aplicable. Por sí sola no determina si puede solicitar la póliza.',
  'EXCLUSIÓN': 'Circunstancia o pérdida que el contrato excluye expresamente de cobertura.',
  'LIMITACIÓN': 'Restricción documentada de monto, duración, frecuencia o alcance de un beneficio.',
  ESPERA: 'Período contractual que debe transcurrir para un beneficio o situación especificados.',
  'REQUIERE REVISIÓN': 'Falta una validación o decisión autorizada. No equivale a aprobación ni a rechazo.'
});
export function normalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function criticalQuestion(question) {
  return /calific|elegib|preexist|pre.exist|exclu|limitaci|limitation|espera|underwriting|cobert|cubre|cubrir|reclamo|claim|infarto|cardiac|diabet|sintoma|diagnost|tratamiento|embaraz|dependient|\bhijos\b/.test(normalize(question));
}
export function channelQuestion(question) {
  return /signature|agent connect|\bipad\b|\bcanal(?:es)?\b|donde (?:se )?vend|por donde|dos productos|misma poliza/.test(normalize(question));
}
export function companyAllowed(user, company) {
  if (!['combined', 'manhattan', 'sunhealth', 'aca'].includes(company)) return false;
  if (user?.role === 'admin') return true;
  const p = user?.permissions?.products || user?.permissions || {};
  return company === 'aca' ? Array.isArray(p.aca) && p.aca.length > 0 : p[company] === true;
}
export function canonicalProductId(id) { return id === 'ss-as' ? 'sig-as' : id; }
export function scopeEvidence(hits, productId, state) {
  // An explicit product must never silently fall back to a different product.
  return (hits || []).filter(x => (!productId || !x.product_id || canonicalProductId(x.product_id) === canonicalProductId(productId))
    && (!x.state || x.state === state || x.state === 'ALL' || x.state === 'US'));
}
export function categoriesInQuestion(question) {
  const q = normalize(question);
  const categories = [];
  if (/no calific|no elegib|inelegib/.test(q)) categories.push('NO CALIFICA');
  if (/preexist|pre.exist/.test(q)) categories.push('PREEXISTENCIA');
  if (/exclu/.test(q)) categories.push('EXCLUSIÓN');
  if (/limitaci|limitation/.test(q)) categories.push('LIMITACIÓN');
  if (/espera|waiting/.test(q)) categories.push('ESPERA');
  if (/revision|revisar|underwriting/.test(q)) categories.push('REQUIERE REVISIÓN');
  return categories;
}
export function operationalChannelAnswer() {
  return 'Regla operativa confirmada por Carlos Barona: Signature = canal iPad; Signature Solutions = Agent Connect. A&S es la misma póliza disponible por ambos canales, no dos productos distintos.\n\nLa matriz completa de productos por canal sigue pendiente de validación documental. No puedo confirmar otras asignaciones ni hacer esa matriz certificable sin la evidencia correspondiente.';
}
export function guardedAnswer(question, hits = []) {
  if (channelQuestion(question)) return {
    answer: operationalChannelAnswer(), status: 'operational', kind: 'channel_policy',
    review: true, categories: categoriesInQuestion(question),
    sources: [{ label: 'Regla operativa de Carlos Barona · matriz documental pendiente', status: 'operational', href: '' }]
  };
  if (!criticalQuestion(question)) return null;
  const categories = categoriesInQuestion(question);
  const definitions = categories.map(k => k + ': ' + CATEGORY_DEFINITIONS[k]).join('\n');
  const conflict = hits.some(x => x.trust_status === 'conflict');
  const excerpts = hits.slice(0, 3).map((x, i) => '[' + (i + 1) + '] ' + x.title
    + (x.page_number ? ' · pág. ' + x.page_number : '')
    + ' · ' + (x.trust_status || 'pendiente') + '\n' + String(x.content || '').slice(0, 1200)).join('\n\n');
  return {
    answer: (definitions ? 'Criterio de interpretación de Meteoro:\n' + definitions + '\n\n' : '')
      + (conflict ? 'Hay un conflicto entre las fuentes; se necesita revisión humana.\n\n' : '')
      + (excerpts ? 'Fragmentos para revisar; no constituyen una decisión sobre el caso:\n\n' + excerpts
        : MISSING)
      + '\n\nNO CALIFICA, PREEXISTENCIA, EXCLUSIÓN, LIMITACIÓN, ESPERA y REQUIERE REVISIÓN son categorías distintas. Ninguna se convierte automáticamente en otra. Para resolver el caso deben verificarse el formulario, estado, versión y preguntas de la solicitud aplicables; Cindy no confirma aprobación, emisión ni pago.',
    status: conflict ? 'conflict' : hits.length ? 'operational' : 'missing',
    kind: 'critical_review', review: true, categories, sources: null
  };
}
export function responseStatus(hits, answer, localStatus, guarded) {
  if (guarded) return guarded.status;
  if (/no puedo confirmar|no (?:se )?encontr|no establece|no especifica/i.test(answer)) return 'missing';
  if (hits.some(x => x.trust_status === 'conflict') || localStatus === 'conflict') return 'conflict';
  // Retrieval success does not validate a generated conclusion or a browser-supplied quote.
  return hits.length || localStatus && localStatus !== 'missing' ? 'operational' : 'missing';
}
