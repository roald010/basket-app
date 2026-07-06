// Parses pasted recipe text into structured, serving-scaled ingredients using
// Claude (Haiku 4.5 -- cheap, fast, well-suited to bounded structured extraction).
// Runs server-side only: the ANTHROPIC_API_KEY secret must never reach the client.
// Supabase verifies the caller's JWT before this handler runs (default verify_jwt
// behavior) -- no manual auth check needed here.
import Anthropic from 'npm:@anthropic-ai/sdk@0.110.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const INGREDIENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The recipe title/name.' },
    servingsDetected: {
      type: 'integer',
      description: "The recipe's own stated serving count. If not stated, your best estimate.",
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number', description: 'Numeric quantity at the ORIGINAL (unscaled) serving count.' },
          unit: { type: 'string', description: 'e.g. "g", "ml", "stuk", "teen" -- empty string if unitless.' },
        },
        required: ['name', 'quantity', 'unit'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'servingsDetected', 'ingredients'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Je extraheert structuur uit geplakte recepttekst (Nederlands of Engels).
Geef de titel, het aantal personen waarvoor het recept origineel is (servingsDetected),
en elk ingredient met naam, hoeveelheid en eenheid -- bij het ORIGINELE aantal porties,
niet geschaald. Gebruik "" als eenheid wanneer een ingredient geen eenheid heeft (bv. "2 eieren").
Sla instructiestappen over -- alleen de ingredientenlijst telt.`;

type ParseRequest = {
  text: string;
  servingsTarget: number;
};

type ParsedIngredient = { name: string; quantity: number; unit: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { text, servingsTarget } = body;
  if (!text || typeof text !== 'string' || !servingsTarget || servingsTarget <= 0) {
    return new Response(JSON.stringify({ error: 'text and a positive servingsTarget are required' }), {
      status: 400,
    });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: INGREDIENT_SCHEMA } },
      messages: [{ role: 'user', content: text }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Model returned no text content');
    }

    const parsed: { title: string; servingsDetected: number; ingredients: ParsedIngredient[] } = JSON.parse(
      textBlock.text
    );

    const scale = servingsTarget / parsed.servingsDetected;
    const scaledIngredients = parsed.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: Math.round(ingredient.quantity * scale * 100) / 100,
    }));

    return new Response(
      JSON.stringify({
        title: parsed.title,
        servingsDetected: parsed.servingsDetected,
        servingsTarget,
        ingredients: scaledIngredients,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('parse-recipe failed', error);
    return new Response(JSON.stringify({ error: 'Failed to parse recipe' }), { status: 502 });
  }
});
