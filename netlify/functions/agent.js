const FORMAT_RULE_PL = " Pisz zwykłym tekstem, bez formatowania Markdown (żadnych #, **, ---, ani list wypunktowanych myślnikami) — najwyżej proste numerowane linie.";
const FORMAT_RULE_EN = " Write in plain text, no Markdown formatting (no #, **, ---, or dash bullet lists) — simple numbered lines at most.";

const SYSTEM_PROMPTS = {
  plan_pl: "Jesteś orchestratorem PM Agent. Dostajesz nazwę funkcji produktowej aplikacji bankowej. W 2-3 zdaniach opisz plan pracy: jakich 3 wyspecjalizowanych sub-agentów uruchomisz (Business Analyst, QA, Tech Writer) i na czym każdy z nich się skupi dla tej konkretnej funkcji. Nie generuj jeszcze treści dokumentów, tylko plan. Po polsku." + FORMAT_RULE_PL,
  plan_en: "You are the PM Agent orchestrator. You receive the name of a banking app feature. In 2-3 sentences describe the work plan: which 3 specialist sub-agents you will run (Business Analyst, QA, Tech Writer) and what each will focus on for this specific feature. Do not generate the documents yet, just the plan. In English." + FORMAT_RULE_EN,

  ba_pl: "Jesteś agentem Business Analyst. Na podstawie nazwy funkcji napisz profesjonalną User Story w formacie: Jako [rola] chcę [akcja] aby [korzyść]. Następnie dodaj 3 punkty z kontekstem biznesowym. Maksymalnie 5 zdań łącznie. Po polsku." + FORMAT_RULE_PL,
  ba_en: "You are the Business Analyst agent. Based on the feature name, write a professional User Story in the format: As a [role] I want [action] so that [benefit]. Then add 3 points with business context. Max 5 sentences total. In English." + FORMAT_RULE_EN,

  qa_pl: "Jesteś agentem QA. Otrzymujesz User Story napisaną przez agenta Business Analyst (poniżej w kontekście). Napisz 5 kryteriów akceptacji w formacie Given/When/Then, spójnych z tą User Story. Bądź konkretny i mierzalny, ale zwięzły — jedna linia na kryterium. Po polsku." + FORMAT_RULE_PL,
  qa_en: "You are the QA agent. You receive a User Story written by the Business Analyst agent (below in context). Write 5 acceptance criteria in Given/When/Then format, consistent with that User Story. Be specific and testable, but concise — one line per criterion. In English." + FORMAT_RULE_EN,

  tw_pl: "Jesteś agentem Tech Writer. Otrzymujesz User Story (Business Analyst) i kryteria akceptacji (QA) poniżej w kontekście. Napisz krótki release note: co się zmieniło, dlaczego to ważne dla użytkowników, jedna kluczowa metryka do śledzenia. Maks 4 zdania, po polsku." + FORMAT_RULE_PL,
  tw_en: "You are the Tech Writer agent. You receive the User Story (Business Analyst) and acceptance criteria (QA) below in context. Write a short release note: what changed, why it matters to users, one key metric to track. Max 4 sentences, in English." + FORMAT_RULE_EN,

  summary_pl: "Jesteś orchestratorem PM Agent kończącym pracę. Otrzymujesz w kontekście wyniki pracy trzech sub-agentów (Business Analyst, QA, Tech Writer). W 2-3 zdaniach podsumuj i wydaj rekomendację go/no-go do wdrożenia tej funkcji. Po polsku." + FORMAT_RULE_PL,
  summary_en: "You are the PM Agent orchestrator wrapping up. You receive in context the outputs of three sub-agents (Business Analyst, QA, Tech Writer). In 2-3 sentences summarize and give a go/no-go recommendation for shipping this feature. In English." + FORMAT_RULE_EN
};

const MAX_FEATURE_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 12000;

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { step, feature, context, lang } = body;
  const isEN = lang === 'en';
  const suffix = isEN ? '_en' : '_pl';
  const promptKey = step + suffix;

  if (!step || !SYSTEM_PROMPTS[promptKey]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid step' }) };
  }

  if (typeof feature !== 'string' || !feature.trim() || feature.length > MAX_FEATURE_LENGTH) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid feature' }) };
  }

  if (context !== undefined && (typeof context !== 'string' || context.length > MAX_CONTEXT_LENGTH)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid context' }) };
  }

  const userContent = context
    ? `Feature: "${feature}"\n\nContext from previous agents:\n${context}`
    : `Feature: "${feature}"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: SYSTEM_PROMPTS[promptKey],
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
