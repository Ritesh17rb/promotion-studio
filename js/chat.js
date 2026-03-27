/**
 * Chat Module - GenAI Conversational Search
 * Handles natural language queries for data exploration and scenario analysis
 *
 * Dependencies: asyncllm, marked, highlight.js, lit-html, bootstrap-llm-provider
 */

import { asyncLLM } from "asyncllm";
import { bootstrapAlert } from "bootstrap-alert";
import { openaiConfig } from "bootstrap-llm-provider";
import hljs from "highlight.js";
import { html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Marked } from "marked";
import { parse } from "partial-json";
import saveform from "saveform";

// Initialize Markdown renderer with code highlighting
const marked = new Marked();
marked.use({
  renderer: {
    code(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return /* html */ `<pre class="hljs language-${language}"><code>${
        hljs.highlight(code, { language }).value.trim()
      }</code></pre>`;
    },
  },
});

// Default LLM provider endpoints
const DEFAULT_BASE_URLS = [
  // OpenAI endpoints
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  // OpenRouter endpoints
  "https://openrouter.ai/api/v1",
  "https://aipipe.org/openrouter/v1",
];

// Settings form persistence
const settingsForm = saveform("#settings-form");

// Conversation history
let conversationHistory = [];
let dataContext = null;

// Default system prompt template
const DEFAULT_SYSTEM_PROMPT = `You are the Promotion Optimization Assistant for the Supergoop Seasonal Promotion Studio.

Your job is to recommend practical promotion actions by SKU and channel using:
- current season inventory position
- competitor price gaps
- social engagement trend
- historical promo effectiveness
- elasticity context by channel group

Current business context:
- Total customers: {currentCustomers}
- Customer breakdown: {currentCustomersBreakdown}
- Monthly revenue: {currentRevenue}
- Revenue breakdown: {currentRevenueBreakdown}
- Avg order value: {currentAov}
- AOV breakdown: {currentAovBreakdown}
- Average repeat-loss rate: {currentChurn}
- Channel repeat-loss breakdown: {currentChurnBreakdown}
- Current season position: week {seasonWeek} of {seasonLength}

Channel response context:
- Mass channel group baseline elasticity: {elasticityAdSupported}
- Prestige channel group baseline elasticity: {elasticityAdFree}
- Competitor signal summary: {competitorSignalSummary}
- Competitor feed summary: {competitorFeedSummary}
- Social signal summary: {socialSignalSummary}

Inventory and promo history:
- Inventory highlights: {inventoryHighlights}
- Promo history summary: {promoHistorySummary}
- SKU optimization insights: {skuOptimizationInsights}
- Current live promo snapshot: {livePromoSnapshot}

Available scenarios:
{availableScenarios}

Current simulation:
{currentSimulation}

Saved scenarios:
{savedScenarios}

Customer segmentation:
{segmentSummary}

Available segments:
{availableSegments}

Tools available:
1) interpret_scenario
2) suggest_scenario
3) analyze_chart
4) compare_outcomes
5) create_scenario
6) query_segments
7) query_promo_history
8) recommend_promo_mix

How to respond:
- Be concise and business-facing.
- Give concrete SKU/channel actions, not generic advice.
- Call out trade-offs (sales lift vs margin impact).
- Prefer season-end inventory-to-zero logic using the configured planning horizon.
- If competitor gap is high in mass channels, bias toward defensive mass recommendations.
- If social momentum is strong, bias toward selective/full-price holds for less-elastic SKUs.
- Explicitly list which SKUs to include and exclude.
- Use Markdown.
`;

/**
 * Initialize chat module with data context
 * @param {Object} context - Application data context
 */
export function initializeChat(context) {
  dataContext = context;

  // Set up settings form handlers
  const resetButton = document.querySelector("#settings-form [type=reset]");
  const saveButton = document.getElementById("settings-save-btn");
  const systemPromptInput = document.getElementById("systemPrompt");

  // Load default prompt only on first visit (when no saved value exists)
  // Check localStorage directly to avoid overwriting restored values
  if (systemPromptInput) {
    const savedData = localStorage.getItem('saveform:#settings-form');
    const hasSavedPrompt = savedData && JSON.parse(savedData).systemPrompt;

    // Only populate default if there's no saved value AND textarea is empty
    if (!hasSavedPrompt && !systemPromptInput.value.trim()) {
      systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
      // Trigger saveform to save this initial value
      settingsForm.save();
    }
  }

  // Explicitly save form data when Save button is clicked
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      settingsForm.save();
      console.log('Settings saved to localStorage');
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      settingsForm.clear();
      // Show default prompt in textarea after reset
      if (systemPromptInput) {
        systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
        // Save the reset values
        settingsForm.save();
      }
    });
  }

  // Check if LLM is already configured and enable chat UI
  checkAndEnableChatUI();
}

/**
 * Check if LLM is configured and enable chat UI if so
 */
async function checkAndEnableChatUI() {
  try {
    // Try to get existing config without showing modal
    const config = await openaiConfig({
      defaultBaseUrls: DEFAULT_BASE_URLS,
      show: false  // Don't show modal, just check if config exists
    });

    // If we got a config with apiKey, enable the chat UI
    if (config && config.apiKey) {
      console.log('LLM already configured, enabling chat UI');
      document.getElementById('chat-input').disabled = false;
      document.getElementById('chat-send-btn').disabled = false;
      document.querySelectorAll('.suggested-query').forEach(btn => {
        btn.disabled = false;
      });
    } else {
      console.log('LLM not configured yet, chat UI will remain disabled until configuration');
    }
  } catch (error) {
    // Config doesn't exist yet, that's fine
    console.log('LLM not configured yet:', error.message);
  }
}

/**
 * Get the model name from settings form
 * @returns {string} The model name
 */
function getModelName() {
  const modelInput = document.getElementById("model");
  return modelInput?.value || "gpt-4.1-mini";
}

/**
 * Configure LLM settings - Shows the configuration modal
 */
export async function configureLLM() {
  try {
    await openaiConfig({
      show: true,
      defaultBaseUrls: DEFAULT_BASE_URLS
    });

    // Enable chat UI after configuration
    document.getElementById('chat-input').disabled = false;
    document.getElementById('chat-send-btn').disabled = false;
    document.querySelectorAll('.suggested-query').forEach(btn => {
      btn.disabled = false;
    });

    bootstrapAlert({
      color: "success",
      title: "LLM Configured",
      body: "You can now start asking questions!"
    });
  } catch (error) {
    console.error('Error configuring LLM:', error);
    bootstrapAlert({
      color: "danger",
      title: "Configuration Error",
      body: error.message
    });
  }
}

/**
 * Build system prompt with current scenario-focused context
 */
function buildSystemPrompt() {
  const allScenarios = dataContext.allScenarios || [];
  const businessContext = dataContext.businessContext || {};
  const currentSim = dataContext.getCurrentSimulation ? dataContext.getCurrentSimulation() : null;
  const savedScenarios = dataContext.getSavedScenarios ? dataContext.getSavedScenarios() : [];

  // Check if user has provided a custom system prompt
  const customPromptInput = document.getElementById("systemPrompt");
  const customPrompt = customPromptInput?.value?.trim();

  // Use custom prompt if provided, otherwise use default
  let promptTemplate = customPrompt || DEFAULT_SYSTEM_PROMPT;

  // Format saved scenarios for the prompt
  const savedScenariosText = savedScenarios.length > 0
    ? savedScenarios.map(s => {
        if (s.delta && s.delta.revenue_pct !== undefined) {
          return `- ${s.scenario_id}: ${s.scenario_name} (Revenue ${s.delta.revenue_pct >= 0 ? '+' : ''}${s.delta.revenue_pct.toFixed(1)}%, Customers ${s.delta.customers_pct >= 0 ? '+' : ''}${s.delta.customers_pct.toFixed(1)}%)`;
        } else {
          return `- ${s.scenario_id}: ${s.scenario_name}`;
        }
      }).join('\n')
    : 'No scenarios saved for comparison yet';

  // Get segment data if available
  let segmentSummary = 'Segment data not loaded yet';
  let availableSegments = 'No segments available';

  if (window.segmentEngine) {
    try {
      // Get all segments to compute summary
      const allSegments = window.segmentEngine.filterSegments({});

      if (allSegments && allSegments.length > 0) {
        // Compute segment statistics
        const totalSegments = allSegments.length;
        const tierCounts = {};
        let totalCustomers = 0;
        let totalRepeatLoss = 0;
        let totalAOV = 0;

        allSegments.forEach(seg => {
          tierCounts[seg.tier] = (tierCounts[seg.tier] || 0) + 1;
          totalCustomers += parseInt(seg.customer_count) || 0;
          totalRepeatLoss += parseFloat(seg.repeat_loss_rate) || 0;
          totalAOV += parseFloat(seg.avg_order_value) || 0;
        });

        const avgRepeatLoss = (totalRepeatLoss / totalSegments * 100).toFixed(2);
        const avgAOV = (totalAOV / totalSegments).toFixed(2);

        segmentSummary = `${totalSegments} behavioral segments across 2 channel groups:
- Target & Amazon: ${tierCounts['ad_supported'] || 0} segments
- Sephora & Ulta: ${tierCounts['ad_free'] || 0} segments
Total Customers: ${totalCustomers.toLocaleString()}
Avg Repeat Loss: ${avgRepeatLoss}%
Avg Order Value: $${avgAOV}`;

        // List available segments for targeting (15 predefined segments)
        availableSegments = `Behavioral segments for targeted pricing:
Acquisition: seasonal_first_time, routine_refill, gift_buyer, influencer_discovered, promo_triggered
Repeat behavior: prestige_loyalist, value_seeker, deal_hunter, occasional_shop, channel_switcher
Basket mix: single_sku_staple, multi_sku_builder, value_bundle_buyer, premium_add_on, trial_size_sampler

Use filters by channel group, repeat-loss risk, and value tier.`;
      }
    } catch (error) {
      console.error('Error getting segment data for chat:', error);
    }
  }

  const inventoryHighlights = Array.isArray(businessContext.inventoryHighlights)
    ? businessContext.inventoryHighlights
      .slice(0, 5)
      .map(item => `${item.sku_id} (${item.remaining_inventory_units} units, e=${item.avg_base_elasticity?.toFixed?.(2) ?? item.avg_base_elasticity})`)
      .join('; ')
    : 'N/A';

  const competitorSignalSummary = businessContext.competitorSignals
    ? `mass comp $${(businessContext.competitorSignals.massAvgCompetitorPrice || 0).toFixed(2)}, prestige comp $${(businessContext.competitorSignals.prestigeAvgCompetitorPrice || 0).toFixed(2)}, mass gap ${(businessContext.competitorSignals.massGapAvgPct || 0) >= 0 ? '+' : ''}${((businessContext.competitorSignals.massGapAvgPct || 0) * 100).toFixed(1)}%, prestige gap ${(businessContext.competitorSignals.prestigeGapAvgPct || 0) >= 0 ? '+' : ''}${((businessContext.competitorSignals.prestigeGapAvgPct || 0) * 100).toFixed(1)}%`
    : 'N/A';

  const competitorFeedSummary = businessContext.competitorFeedSummary
    ? `${businessContext.competitorFeedSummary.rows || 0} scraped rows, ${businessContext.competitorFeedSummary.matchedSkus || 0} matched SKUs, sources: ${(businessContext.competitorFeedSummary.sources || []).join(', ') || 'n/a'}`
    : 'N/A';

  const socialSignalSummary = businessContext.socialSignal
    ? `score ${Number(businessContext.socialSignal.score || 0).toFixed(1)}, trend ${(businessContext.socialSignal.trendDelta || 0) >= 0 ? '+' : ''}${Number(businessContext.socialSignal.trendDelta || 0).toFixed(2)} vs prior week`
    : 'N/A';

  const promoHistorySummary = businessContext.promoHistorySummary
    ? `${businessContext.promoHistorySummary.campaignCount || 0} campaigns; top underperformers: ${(businessContext.promoHistorySummary.topUnderperformingSkus || []).join(', ') || 'none'}; top winners: ${(businessContext.promoHistorySummary.topWinningSkus || []).join(', ') || 'none'}`
    : 'N/A';
  const skuOptimizationInsights = businessContext.skuOptimizationInsights
    ? `include: ${(businessContext.skuOptimizationInsights.recommended_includes || []).join(', ') || 'none'}; exclude: ${(businessContext.skuOptimizationInsights.recommended_excludes || []).join(', ') || 'none'}; note: ${businessContext.skuOptimizationInsights.objective_note || 'n/a'}`
    : 'N/A';

  const vizData = dataContext.getVisualizationData ? dataContext.getVisualizationData() : {};
  const livePromoSnapshotObj = vizData.livePromoSnapshot || null;
  const livePromoSnapshot = livePromoSnapshotObj
    ? `objective=${livePromoSnapshotObj.objective}, mass=${livePromoSnapshotObj.massPromoDepthPct}%, prestige=${livePromoSnapshotObj.prestigePromoDepthPct}%, revenue_delta=${(livePromoSnapshotObj.revenueDeltaPct * 100).toFixed(1)}%, profit_delta=${(livePromoSnapshotObj.profitDeltaPct * 100).toFixed(1)}%`
    : 'No live promo simulation yet';

  // Replace placeholders with actual values
  const prompt = promptTemplate
    .replace('{currentCustomers}', Number.isFinite(Number(businessContext.currentCustomers)) ? businessContext.currentCustomers.toLocaleString() : 'N/A')
    .replace('{currentCustomersBreakdown}', businessContext.currentCustomersBreakdown || 'N/A')
    .replace('{currentRevenue}', Number.isFinite(Number(businessContext.currentRevenue)) ? `$${businessContext.currentRevenue.toLocaleString()}` : 'N/A')
    .replace('{currentRevenueBreakdown}', businessContext.currentRevenueBreakdown || 'N/A')
    .replace('{currentAov}', Number.isFinite(Number(businessContext.currentAov)) ? `$${businessContext.currentAov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A')
    .replace('{currentAovBreakdown}', businessContext.currentAovBreakdown || 'N/A')
    .replace('{currentChurn}', Number.isFinite(Number(businessContext.currentChurn)) ? `${(businessContext.currentChurn * 100).toFixed(2)}%` : 'N/A')
    .replace('{currentChurnBreakdown}', businessContext.currentChurnBreakdown || 'N/A')
    .replace('{seasonWeek}', (businessContext.currentSeasonWeek || 'N/A').toString())
    .replace('{seasonLength}', (businessContext.seasonWeeks || 'N/A').toString())
    .replace('{elasticityAdSupported}', (businessContext.elasticityByTier?.ad_supported || -2.1).toString())
    .replace('{elasticityAdFree}', (businessContext.elasticityByTier?.ad_free || -1.9).toString())
    .replace('{competitorSignalSummary}', competitorSignalSummary)
    .replace('{competitorFeedSummary}', competitorFeedSummary)
    .replace('{socialSignalSummary}', socialSignalSummary)
    .replace('{inventoryHighlights}', inventoryHighlights)
    .replace('{promoHistorySummary}', promoHistorySummary)
    .replace('{skuOptimizationInsights}', skuOptimizationInsights)
    .replace('{livePromoSnapshot}', livePromoSnapshot)
    .replace('{availableScenarios}', allScenarios.slice(0, 8).map(s => `- ${s.id}: ${s.name}`).join('\n') || 'None loaded yet')
    .replace('{currentSimulation}', currentSim && currentSim.delta ? `Active: "${currentSim.scenario_name}" - Revenue ${currentSim.delta.revenue_pct >= 0 ? '+' : ''}${currentSim.delta.revenue_pct.toFixed(1)}%, Customers ${currentSim.delta.customers_pct >= 0 ? '+' : ''}${currentSim.delta.customers_pct.toFixed(1)}%` : currentSim ? `Active: "${currentSim.scenario_name}"` : 'No scenario simulated yet')
    .replace('{savedScenarios}', savedScenariosText)
    .replace('{segmentSummary}', segmentSummary)
    .replace('{availableSegments}', availableSegments);

  return prompt;
}

/**
 * Define scenario-focused tools for the LLM to call
 */
function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "interpret_scenario",
        description: "Analyze and interpret a specific scenario's simulation results. Provides detailed metrics, trade-offs, risks, and business insights.",
        parameters: {
          type: "object",
          properties: {
            scenario_id: {
              type: "string",
              description: "ID of the scenario to interpret (e.g., 'scenario_001', 'scenario_002', 'scenario_003')"
            }
          },
          required: ["scenario_id"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "suggest_scenario",
        description: "Get AI-powered scenario suggestions based on a specific business goal. Returns optimal strategy and parameters.",
        parameters: {
          type: "object",
          properties: {
            goal: {
              type: "string",
              enum: ["maximize_revenue", "grow_customers", "reduce_churn", "maximize_aov"],
              description: "The business goal to optimize for"
            }
          },
          required: ["goal"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "analyze_chart",
        description: "Explain what a specific visualization shows and how to interpret it. Provides context and insights about the chart.",
        parameters: {
          type: "object",
          properties: {
            chart_name: {
              type: "string",
              enum: ["inventory_projection", "promo_history", "competitor_signal", "competitor_feed", "social_signal", "demand_curve", "tier_mix", "forecast", "heatmap"],
              description: "The name of the chart to analyze"
            }
          },
          required: ["chart_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "compare_outcomes",
        description: "Deep comparison of 2 or more scenarios with trade-off analysis. Shows which scenario is best for each metric and explains the business implications.",
        parameters: {
          type: "object",
          properties: {
            scenario_ids: {
              type: "array",
              items: { type: "string" },
              description: "Array of 2 or more scenario IDs to compare (e.g., ['scenario_001', 'scenario_002', 'scenario_003'])",
              minItems: 2
            }
          },
          required: ["scenario_ids"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_scenario",
        description: "Create a new custom scenario from user-specified parameters (price change or promotion).",
        parameters: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["ad_supported", "ad_free"],
              description: "The subscription tier to apply changes to"
            },
            price_change: {
              type: "number",
              description: "Dollar amount to change price (e.g., 1.00 for +$1, -2.00 for -$2). Omit if creating a promotion."
            },
            promotion_discount: {
              type: "number",
              description: "Discount percentage for promotion (e.g., 50 for 50% off). Required if creating promotion."
            },
            promotion_duration: {
              type: "integer",
              description: "Duration of promotion in months (1-12). Required if creating promotion."
            }
          },
          required: ["tier"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "query_segments",
        description: "Query customer segments with filters to get detailed segment information. Returns segment metrics like customer count, repeat loss rate, avg order value, and elasticity.",
        parameters: {
          type: "object",
          properties: {
            tier: {
              type: "string",
              enum: ["ad_supported", "ad_free", "all"],
              description: "Filter by subscription tier. Use 'all' to include all tiers."
            },
            size: {
              type: "string",
              enum: ["small", "medium", "large", "all"],
              description: "Filter by segment size based on customer count. Use 'all' to include all sizes."
            },
            repeat_loss_risk: {
              type: "string",
              enum: ["low", "medium", "high", "all"],
              description: "Filter by repeat-loss risk level. Use 'all' to include all risk levels."
            },
            value: {
              type: "string",
              enum: ["low", "medium", "high", "all"],
              description: "Filter by segment value (avg order value). Use 'all' to include all value levels."
            },
            limit: {
              type: "integer",
              description: "Maximum number of segments to return (default: 10)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "query_promo_history",
        description: "Query historical promotion outcomes with optional season/channel filters and return suggested SKU inclusions/exclusions.",
        parameters: {
          type: "object",
          properties: {
            season: {
              type: "string",
              description: "Season filter, or 'all' for all seasons."
            },
            channel: {
              type: "string",
              enum: ["all", "target", "amazon", "sephora", "ulta", "dtc"],
              description: "Channel filter"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "recommend_promo_mix",
        description: "Recommend SKU-level promo inclusion and exclusion using inventory, elasticity, competitor gaps, social trend, and historical promo effectiveness.",
        parameters: {
          type: "object",
          properties: {
            objective: {
              type: "string",
              enum: ["balance", "sales", "profit", "maximize_revenue", "grow_customers", "reduce_churn", "maximize_aov"],
              description: "Optimization objective"
            },
            channel_group: {
              type: "string",
              enum: ["all", "mass", "prestige"],
              description: "Restrict recommendation to one channel group or all"
            }
          },
          required: []
        }
      }
    }
  ];
}

/**
 * Send a message to the LLM
 * @param {string} userMessage - User's question
 * @returns {Promise<string|null>}
 */
export async function sendMessage(userMessage, options = {}) {
  const { renderUi = true, isolatedHistory = false } = options;
  if (!dataContext) {
    if (renderUi) {
      bootstrapAlert({
        color: "warning",
        title: "Data Not Loaded",
        body: "Please load data first before asking questions."
      });
    }
    return null;
  }

  const history = renderUi
    ? conversationHistory
    : (isolatedHistory ? [] : [...conversationHistory]);

  // Add user message to UI and history
  if (renderUi) {
    appendMessage('user', userMessage);
  }
  history.push({
    role: "user",
    content: userMessage
  });

  // Show loading indicator
  const loadingId = renderUi ? appendMessage('assistant', '...', true) : null;

  try {
    // Get LLM config from localStorage (or show config modal if not set)
    const { baseUrl, apiKey } = await openaiConfig({
      defaultBaseUrls: DEFAULT_BASE_URLS
    });

    // Prepare API request (NON-STREAMING first to get tool calls immediately)
    const requestBody = {
      model: getModelName(),
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...history
      ],
      ...(renderUi ? {
        tools: getToolDefinitions(),
        tool_choice: "auto"
      } : {}),
      stream: false  // ✨ Non-streaming to avoid partial "thinking" text
    };

    // Make non-streaming request to get tool calls immediately
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Handle response based on whether tools were called
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Remove loading indicator (no partial text to show)
      if (renderUi && loadingId) {
        removeMessage(loadingId);
      }

      // Add assistant message with tool calls to history
      history.push({
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls
      });

      // Execute tool calls and get STREAMING final response
      return await executeToolCalls(message.tool_calls, { renderUi, history });
    } else {
      // No tool calls - got direct answer
      if (message.content) {
        // Update with final message
        if (renderUi && loadingId) {
          updateMessage(loadingId, message.content, false);
        }

        // Add to history
        history.push({
          role: "assistant",
          content: message.content
        });
        return message.content;
      } else {
        if (renderUi && loadingId) {
          removeMessage(loadingId);
        }
        return null;
      }
    }

  } catch (error) {
    console.error('Error sending message:', error);
    if (renderUi && loadingId) {
      removeMessage(loadingId);
    }
    if (renderUi) {
    appendMessage('assistant', `❌ Error: ${error.message}`, false, 'error');
    bootstrapAlert({
      color: "danger",
      title: "LLM Error",
      body: error.message
    });
    }
    return null;
  }
}

/**
 * Execute tool calls and send results back to LLM
 */
async function executeToolCalls(toolCalls, options = {}) {
  const { renderUi = true, history = conversationHistory } = options;
  const toolResults = [];

  for (const toolCall of toolCalls) {
    const toolName = toolCall.function.name;
    let args = {};

    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Error parsing tool arguments:', e);
      args = {};
    }

    appendMessage('system', `🔧 Executing: ${toolName}`, false, 'tool');

    try {
      const result = await executeTool(toolName, args);

      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: toolName,
        content: JSON.stringify(result)
      });

      appendMessage('system', `✅ ${toolName} completed`, false, 'tool');
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: toolName,
        content: JSON.stringify({ error: error.message })
      });

      appendMessage('system', `❌ ${toolName} failed: ${error.message}`, false, 'tool-error');
    }
  }

  // Add tool results to history
  history.push(...toolResults);

  // Get LLM's final response after tool execution
  return await getContinuationResponse();
}

/**
 * Get continuation response from LLM after tool execution
 */
async function getContinuationResponse() {
  const loadingId = appendMessage('assistant', '...', true);

  try {
    // Get LLM config from localStorage
    const { baseUrl, apiKey } = await openaiConfig({
      defaultBaseUrls: DEFAULT_BASE_URLS
    });

    const requestBody = {
      model: getModelName(),
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...conversationHistory
      ],
      stream: true
    };

    let assistantMessage = '';
    let lastUpdateTime = 0;
    const updateInterval = 50; // Update UI every 50ms max (20 FPS)

    for await (const chunk of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
    })) {

      if (chunk.error) {
        throw new Error(chunk.error);
      }

      // asyncLLM returns chunks with {content, message} format
      // IMPORTANT: chunk.content contains FULL accumulated text, not delta!
      // Handle both formats: asyncLLM's simplified format and OpenAI's standard format
      let content = null;
      let finishReason = null;

      if (chunk.choices && chunk.choices.length > 0) {
        // Standard OpenAI format (delta - incremental content)
        const delta = chunk.choices[0].delta;
        if (delta?.content) {
          assistantMessage += delta.content;  // Accumulate deltas
          content = assistantMessage;
        }
        finishReason = chunk.choices[0].finish_reason;
      } else if (chunk.content !== undefined) {
        // asyncLLM simplified format (full accumulated content)
        content = chunk.content;  // Use directly, don't accumulate!
        assistantMessage = content;  // Store for history
        finishReason = chunk.message?.finish_reason;
      }

      if (content) {
        // Throttle UI updates for better performance
        const now = Date.now();
        if (now - lastUpdateTime > updateInterval || finishReason) {
          updateMessage(loadingId, content, false);
          lastUpdateTime = now;
        }
      }

      if (finishReason && finishReason === 'stop') {
        break;
      }
    }

    // Final update to ensure all content is rendered
    if (assistantMessage) {
      updateMessage(loadingId, assistantMessage, false);
    }

    if (assistantMessage) {
      // Add final response to history
      conversationHistory.push({
        role: "assistant",
        content: assistantMessage
      });
    } else {
      removeMessage(loadingId);
      appendMessage('assistant', 'No response received from the model.', false, 'error');
    }

  } catch (error) {
    console.error('Error getting continuation:', error);
    removeMessage(loadingId);
    appendMessage('assistant', `❌ Error: ${error.message}`, false, 'error');
  }
}

/**
 * Execute a specific scenario-focused tool
 */
async function executeTool(toolName, args) {
  switch (toolName) {
    case 'interpret_scenario':
      return await dataContext.interpretScenario(args.scenario_id);

    case 'suggest_scenario':
      return await dataContext.suggestScenario(args.goal);

    case 'analyze_chart':
      return await dataContext.analyzeChart(args.chart_name);

    case 'compare_outcomes':
      return await dataContext.compareOutcomes(args.scenario_ids);

    case 'create_scenario':
      return await dataContext.createScenario(args);

    case 'query_segments':
      return await querySegments(args);

    case 'query_promo_history':
      return await dataContext.queryPromoHistory(args);

    case 'recommend_promo_mix':
      return await dataContext.recommendPromoMix(args);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Query segments with filters
 */
async function querySegments(filters) {
  if (!window.segmentEngine) {
    throw new Error('Segmentation engine not available');
  }

  // Get all segments (filterSegments only handles acquisition/engagement/monetization)
  let segments = window.segmentEngine.filterSegments({});

  // Apply custom filters manually
  if (filters.tier && filters.tier !== 'all') {
    segments = segments.filter(seg => seg.tier === filters.tier);
  }

  if (filters.size && filters.size !== 'all') {
    segments = segments.filter(seg => {
      const count = parseInt(seg.customer_count) || 0;
      if (filters.size === 'small') return count < 1000;
      if (filters.size === 'medium') return count >= 1000 && count < 3000;
      if (filters.size === 'large') return count >= 3000;
      return true;
    });
  }

  if (filters.repeat_loss_risk && filters.repeat_loss_risk !== 'all') {
    segments = segments.filter(seg => {
      const repeatLoss = parseFloat(seg.repeat_loss_rate) || 0;
      if (filters.repeat_loss_risk === 'low') return repeatLoss < 0.10;
      if (filters.repeat_loss_risk === 'medium') return repeatLoss >= 0.10 && repeatLoss < 0.20;
      if (filters.repeat_loss_risk === 'high') return repeatLoss >= 0.20;
      return true;
    });
  }

  if (filters.value && filters.value !== 'all') {
    segments = segments.filter(seg => {
      const aov = parseFloat(seg.avg_order_value) || 0;
      if (filters.value === 'low') return aov < 28;
      if (filters.value === 'medium') return aov >= 28 && aov < 42;
      if (filters.value === 'high') return aov >= 42;
      return true;
    });
  }

  // Apply limit
  const limit = filters.limit || 10;
  segments = segments.slice(0, limit);

  // Format segment data for the LLM
  const segmentData = segments.map(seg => {
    const elasticity = window.segmentEngine.getElasticity(seg.tier, seg.compositeKey);
    const repeatLoss = parseFloat(seg.repeat_loss_rate) || 0;
    const aov = parseFloat(seg.avg_order_value) || 0;
    const customerCount = parseInt(seg.customer_count) || 0;

    return {
      composite_key: seg.compositeKey,
      tier: seg.tier,
      acquisition: seg.acquisition,
      engagement: seg.engagement,
      monetization: seg.monetization,
      customer_count: customerCount,
      repeat_loss_rate: (repeatLoss * 100).toFixed(2) + '%',
      avg_order_value: '$' + aov.toFixed(2),
      elasticity: elasticity?.toFixed(2) || 'N/A',
      segment_name: generateSegmentName(seg)
    };
  });

  return {
    total_segments: segmentData.length,
    filters_applied: filters,
    segments: segmentData,
    summary: `Found ${segmentData.length} segments matching the criteria.`
  };
}

/**
 * Generate a human-readable segment name
 */
function generateSegmentName(segment) {
  const acqMap = { low: 'Loyal', medium: 'Moderate', high: 'Deal-Seeking' };
  const engMap = { low: 'Casual', medium: 'Regular', high: 'Heavy' };
  const monMap = { low: 'At-Risk', medium: 'Stable', high: 'Premium' };

  const acq = acqMap[segment.acquisition] || segment.acquisition;
  const eng = engMap[segment.engagement] || segment.engagement;
  const mon = monMap[segment.monetization] || segment.monetization;

  return `${acq} ${eng} ${mon}`;
}

/**
 * Append a message to the chat UI
 */
function appendMessage(role, content, isLoading = false, customClass = '') {
  const messagesDiv = document.getElementById('chat-messages');
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `chat-message mb-3 ${role} ${customClass}`;

  const icon = role === 'user' ? '👤' : role === 'system' ? '⚙️' : '🤖';
  const label = role === 'user' ? 'You' : role === 'system' ? 'System' : 'AI Assistant';

  if (isLoading) {
    messageDiv.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="me-2">${icon}</div>
        <div class="flex-grow-1">
          <div class="text-muted small mb-1">${label}</div>
          <div class="message-content">
            <span class="spinner-border spinner-border-sm me-2"></span>
            <span class="text-muted">Thinking...</span>
          </div>
        </div>
      </div>
    `;
  } else {
    const formattedContent = role === 'assistant' ? marked.parse(content) : content;
    messageDiv.innerHTML = `
      <div class="d-flex align-items-start">
        <div class="me-2">${icon}</div>
        <div class="flex-grow-1">
          <div class="text-muted small mb-1">${label}</div>
          <div class="message-content">${formattedContent}</div>
        </div>
      </div>
    `;
  }

  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  return messageId;
}

/**
 * Update an existing message
 */
function updateMessage(messageId, content, isLoading = false) {
  const messageDiv = document.getElementById(messageId);
  if (!messageDiv) return;

  const contentDiv = messageDiv.querySelector('.message-content');
  if (!contentDiv) return;

  if (isLoading) {
    contentDiv.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2"></span>
      <span class="text-muted">Thinking...</span>
    `;
  } else {
    contentDiv.innerHTML = marked.parse(content);
  }

  const messagesDiv = document.getElementById('chat-messages');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Remove a message from the UI
 */
function removeMessage(messageId) {
  const messageDiv = document.getElementById(messageId);
  if (messageDiv) {
    messageDiv.remove();
  }
}

/**
 * Clear conversation history
 */
export function clearHistory() {
  conversationHistory = [];
  const messagesDiv = document.getElementById('chat-messages');
  messagesDiv.innerHTML = `
    <div class="text-center text-muted mt-5">
      <i class="bi bi-chat-square-text display-4 mb-3"></i>
      <p>Start a conversation by asking a question about SKU promotions, inventory runway, competitor moves, or social demand signals.</p>
    </div>
  `;
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  try {
    return parse(candidate);
  } catch {
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

async function getLLMConfigSafe() {
  try {
    const config = await openaiConfig({
      defaultBaseUrls: DEFAULT_BASE_URLS,
      show: false
    });
    if (!config || !config.apiKey || !config.baseUrl) return null;
    return config;
  } catch {
    return null;
  }
}

async function requestStructuredJson({ systemPrompt, userPrompt, temperature = 0.2, maxTokens = 900 }) {
  const cfg = await getLLMConfigSafe();
  if (!cfg) {
    throw new Error('LLM is not configured');
  }

  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: getModelName(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error('LLM returned invalid JSON payload');
  }
  return parsed;
}

export async function isLLMConfigured() {
  const cfg = await getLLMConfigSafe();
  return Boolean(cfg && cfg.apiKey);
}

export async function generateLiveCopilot(payload = {}) {
  const liveSnapshot = payload.liveSnapshot
    || (dataContext?.getVisualizationData ? dataContext.getVisualizationData()?.livePromoSnapshot : null)
    || null;
  const businessContext = payload.businessContext || dataContext?.businessContext || {};

  const systemPrompt = `You are a promotion optimization copilot for Supergoop (seasonal sunscreen & moisturizer brand).
The 6 SKUs are: Daily Shield SPF 40 (SUN_S1), Invisible Mist SPF 50 (SUN_S2), Sport Gel SPF 60 (SUN_S3), Hydra Daily Lotion (MOI_M1), Barrier Repair Cream (MOI_M2), Night Recovery Balm (MOI_M3).
The 4 retailers are: Target & Amazon (mass channel), Sephora & Ulta (prestige channel).

Return ONLY valid JSON with schema:
{
  "summary": "string <= 240 chars",
  "posture": "Win-Win|Volume Defense|Margin Guard|Unfavorable|Balanced",
  "confidence": 0-100 number,
  "actions": ["string", "string", "string"],
  "risks": ["string", "string"],
  "why_now": "string <= 160 chars",
  "include_in_promo": "string <= 200 chars — specific SKU names to promote and why (e.g. 'Daily Shield SPF 40 (high inventory, elastic), Sport Gel SPF 60 (above competitor)')",
  "exclude_hold": "string <= 200 chars — specific SKU names to hold/exclude and why (e.g. 'Night Recovery Balm (strong social pull, less elastic)')",
  "risk_watch": "string <= 200 chars — key risks to monitor this week",
  "decision_brief": "string <= 400 chars — numbered brief: 1) Include, 2) Exclude/Hold, 3) Channel plan (name Target/Amazon/Sephora/Ulta), 4) Expected inventory effect",
  "recommended_mass_promo": "number 0-40 — recommended promo depth % for Target & Amazon",
  "recommended_prestige_promo": "number 0-30 — recommended promo depth % for Sephora & Ulta",
  "focus_sku": "string — SKU ID to focus boost on (e.g. SUN_S1) or empty string",
  "sku_boost": "number 0-20 — recommended extra discount % for focus SKU"
}

Rules:
- Name specific products by their full name (not SKU codes) and specific retailers
- If social buzz is high, recommend HOLDING price on those products
- Factor in weeks remaining in season vs inventory levels
- Do NOT fabricate metrics — only reference numbers from the provided data`;

  const userPrompt = JSON.stringify({
    task: 'Analyze current live promo scenario and recommend immediate actions.',
    live_snapshot: liveSnapshot,
    business_context: {
      competitorSignals: businessContext.competitorSignals || null,
      socialSignal: businessContext.socialSignal || null,
      currentSeasonWeek: businessContext.currentSeasonWeek || null,
      seasonWeeks: businessContext.seasonWeeks || null
    }
  });

  return requestStructuredJson({ systemPrompt, userPrompt, temperature: 0.15, maxTokens: 1000 });
}

export async function generateScenarioPlanFromText(payload = {}) {
  const userText = String(payload.userText || '').trim();
  if (!userText) throw new Error('No plan text provided');
  const liveSnapshot = payload.liveSnapshot
    || (dataContext?.getVisualizationData ? dataContext.getVisualizationData()?.livePromoSnapshot : null)
    || null;

  const systemPrompt = `You convert natural-language promo strategy into simulator controls.
Return ONLY valid JSON with schema:
{
  "objective": "balance|sales|profit",
  "massPromoDepthPct": number 0..40,
  "prestigePromoDepthPct": number 0..30,
  "skuBoostPct": number 0..20,
  "competitorShockPct": number -20..20,
  "socialShockPts": number -20..20,
  "applyMass": boolean,
  "applyPrestige": boolean,
  "productGroup": "all|sunscreen|moisturizer",
  "skuFocusName": "string or empty",
  "reasoning": "string <= 220 chars"
}
Use conservative defaults if unclear.`;

  const userPrompt = JSON.stringify({
    instruction: userText,
    current_live_snapshot: liveSnapshot
  });

  return requestStructuredJson({ systemPrompt, userPrompt, temperature: 0.1, maxTokens: 600 });
}

export async function generateEventAnalyst(payload = {}) {
  const event = payload.event || null;
  if (!event) throw new Error('No event provided');
  const liveSnapshot = payload.liveSnapshot
    || (dataContext?.getVisualizationData ? dataContext.getVisualizationData()?.livePromoSnapshot : null)
    || null;
  const businessContext = payload.businessContext || dataContext?.businessContext || {};

  const systemPrompt = `You are an in-season event analyst for promotion optimization.
Return ONLY valid JSON with schema:
{
  "summary": "string <= 220 chars",
  "impact": ["string", "string", "string"],
  "actions": ["string", "string", "string"],
  "urgency": "low|medium|high"
}
Tie analysis to competitor delta, social momentum, inventory runway, and channel context when available.`;

  const userPrompt = JSON.stringify({
    selected_event: event,
    live_snapshot: liveSnapshot,
    context: {
      competitorSignals: businessContext.competitorSignals || null,
      socialSignal: businessContext.socialSignal || null,
      currentSeasonWeek: businessContext.currentSeasonWeek || null
    }
  });

  return requestStructuredJson({ systemPrompt, userPrompt, temperature: 0.2, maxTokens: 700 });
}

