// Customer conversation rehearsal. No model, database or messaging transport.
import { normalize, criticalQuestion, channelQuestion, MISSING } from './policy.mjs';

export function initialConversation() {
  return { mode: 'automatic', phase: 'welcome', interest: '', followupConsent: false };
}
export function sanitizeConversation(value) {
  const v=value && typeof value==='object' ? value : {};
  return {
    mode:['automatic','human','opted_out'].includes(v.mode)?v.mode:'automatic',
    phase:['welcome','consent','review','support','sales'].includes(v.phase)?v.phase:'welcome',
    interest:['support','sales'].includes(v.interest)?v.interest:'',
    followupConsent:v.followupConsent===true
  };
}
export function sensitiveMessage(value) {
  const q = normalize(value);
  return /\b(?:\d[ -]?){9,}\b/.test(q)
    || /seguro social|social security|\bssn\b|tarjeta|cuenta bancaria|account number|password|contrasena|pasaporte|historia clinica|resultado medico|diagnostico|tengo (?:diabetes|cancer)|mi enfermedad/.test(q);
}
function result(state, reply, reason, review = false) {
  return { state, reply, reason, human_review_required: review, send_allowed: false,
    delivery: 'simulation_only', lead_created: false, appointment_confirmed: false };
}
export function customerTurn(text, previous = initialConversation()) {
  const state = sanitizeConversation(previous);
  const q = normalize(text).trim();
  if (!q) return result(state, 'Escribe un mensaje de prueba.', 'empty');
  if (/^(stop|baja|salir|unsubscribe)\b|no me (?:escrib|contact|llam)|deja de (?:escrib|contact)|no quiero (?:mas )?mensajes/.test(q)) {
    return result({ ...state, mode: 'opted_out', followupConsent: false }, '', 'opt_out');
  }
  if (state.mode === 'opted_out') return result(state, '', 'opt_out');
  if (state.mode === 'human') return result(state, '', 'human_active', true);
  if (/humano|persona real|hablar con (?:carlos|un agente|alguien)|asesor|queja|reclamo|reclamacion/.test(q)) {
    return result({ ...state, mode: 'human' }, 'Esta consulta necesita atención de una persona del equipo. En esta demostración queda marcada para revisión; no se ha contactado a un agente.', 'human_requested', true);
  }
  if (sensitiveMessage(text)) {
    return result({ ...state, mode: 'human' }, 'Para cuidar tu información, evita escribir contraseñas, números de identificación, datos bancarios o información médica aquí. Este caso necesita un canal privado con una persona del equipo.', 'sensitive_data', true);
  }
  if (channelQuestion(text) || criticalQuestion(text) || /cuanto (?:paga|cubre)|me pag|aprueb|garantiz/.test(q)) {
    return result({ ...state, mode: 'human' }, MISSING + ' Un agente debe revisar los documentos aplicables a tu consulta. No puedo garantizar elegibilidad, cobertura ni pago.', 'product_review', true);
  }
  if (/comision|agentes|licencia|certific|entrenamiento|administrador|ignora.*instrucc|prompt|sistema interno/.test(q)) {
    return result({ ...state, mode: 'human' }, 'Este canal de demostración es para atención a clientes. Las consultas internas del equipo se atienden en Meteoro con acceso autorizado.', 'internal_request', true);
  }
  if (state.phase === 'consent' && /^(si|acepto|autorizo|de acuerdo)\b/.test(q)) {
    return result({ ...state, phase: 'review', followupConsent: true, mode: 'human' }, 'En esta simulación autorizaste un seguimiento sobre tu consulta. No se creó un contacto ni se confirmó una cita; un agente revisaría la solicitud antes de continuar.', 'followup_requested', true);
  }
  if (state.phase === 'consent' && /^(no|ahora no|no gracias)\b/.test(q)) {
    return result({ ...state, phase: 'welcome', followupConsent: false }, 'De acuerdo. No autorizaste mensajes de seguimiento. Puedes seguir consultando información general.', 'consent_declined');
  }
  if (/caro|no tengo dinero|presupuesto|pensar|comparar/.test(q)) {
    return result({ ...state, phase: 'consent' }, 'Podemos empezar por lo que deseas proteger y el presupuesto que te resulte cómodo, sin compromiso. Autorizas que un agente revise opciones contigo? No hace falta compartir información financiera privada aquí.', 'sales_objection');
  }
  if (/cita|llamada|llamen|contacten|cotiz|precio|cuesta|comprar|contratar/.test(q)) {
    return result({ ...state, phase: 'consent' }, 'La cotización debe revisarse con el producto y los datos aplicables. Autorizas que un agente te contacte para orientarte? Esta demostración no agenda citas ni envía mensajes.', 'sales_followup');
  }
  if (/soporte|ayuda|servicio|poliza|pago|documento|beneficio/.test(q)) {
    return result({ ...state, interest: 'support', phase: 'support' }, 'Qué necesitas: orientación general, ayuda con documentos o hablar con una persona? No escribas tu número de póliza ni datos médicos en esta demostración.', 'support');
  }
  if (/seguro|proteccion|accidente|hospital|cancer|ingreso/.test(q)) {
    return result({ ...state, interest: 'sales', phase: 'sales' }, 'Qué te interesa explorar: protección ante accidentes, apoyo por hospitalización o protección de ingresos? Un agente revisaría contigo las opciones disponibles; aquí no se confirma una cobertura.', 'sales');
  }
  return result(state, 'Hola, soy Cindy, asistente virtual de Meteoro. Esta es una demostración. Puedo ayudarte a explorar una consulta de seguros o indicarte cuándo necesita atención humana. Qué deseas consultar?', 'welcome');
}

export function deliveryDecision({ enabled, approved, lastInboundAt, now = Date.now(), mode, optOut, templateApproved = false, followupConsent = false }) {
  if (!enabled) return { allowed: false, reason: 'disconnected' };
  if (!approved) return { allowed: false, reason: 'human_approval_required' };
  if (optOut || mode === 'opted_out') return { allowed: false, reason: 'opt_out' };
  if (mode === 'human') return { allowed: false, reason: 'human_active' };
  const received = Date.parse(lastInboundAt);
  const inWindow = Number.isFinite(received) && received <= now && now - received < 86400000;
  if (!inWindow && !(templateApproved && followupConsent)) return { allowed: false, reason: 'template_and_consent_required' };
  return { allowed: true, reason: inWindow ? 'service_window' : 'approved_template' };
}
