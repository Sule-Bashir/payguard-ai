function evaluateTransaction(policy, transaction) {
  const reasons = [];
  let allowed = true;

  // 1. Budget
  if (policy.max_budget != null) {
    if (typeof transaction.price !== "number" || isNaN(transaction.price)) {
      allowed = false;
      reasons.push("Transaction price is missing or invalid.");
    } else if (transaction.price > policy.max_budget) {
      allowed = false;
      const over = (transaction.price - policy.max_budget).toFixed(2);
      reasons.push(
        `Price $${transaction.price.toFixed(2)} exceeds authorized maximum of $${policy.max_budget.toFixed(2)} by $${over}.`
      );
    } else {
      reasons.push(
        `Price $${transaction.price.toFixed(2)} is within the $${policy.max_budget.toFixed(2)} budget.`
      );
    }
  }

  const itemText = buildItemText(transaction);

  // 2. Restrictions
  const restrictions = normalizeRestrictions(policy.restrictions);
  for (const r of restrictions) {
    const hit = r.keywords.find((k) => itemText.includes(k));
    if (r.type === "forbid") {
      if (hit) {
        allowed = false;
        reasons.push(`Restriction violated: "${r.text}" (forbidden term "${hit}" found).`);
      } else {
        reasons.push(`Restriction respected: "${r.text}".`);
      }
    } else if (r.type === "require") {
      if (!hit) {
        allowed = false;
        reasons.push(`Restriction not satisfied: "${r.text}" (required term not found).`);
      } else {
        reasons.push(`Restriction satisfied: "${r.text}" (found "${hit}").`);
      }
    }
  }

  // 3. Requirements
  const requirements = normalizeRequirements(policy.requirements);
  for (const req of requirements) {
    const hit = req.keywords.find((k) => itemText.includes(k));
    if (!hit) {
      allowed = false;
      reasons.push(`Requirement not satisfied: "${req.text}".`);
    } else {
      reasons.push(`Requirement satisfied: "${req.text}" (matched "${hit}").`);
    }
  }

  return {
    decision: allowed ? "ALLOW" : "BLOCK",
    reasons,
    policy_snapshot: {
      max_budget: policy.max_budget,
      currency: policy.currency,
      requirements,
      restrictions
    },
    transaction_snapshot: {
      item: transaction.item,
      price: transaction.price,
      specs: transaction.specs || {}
    }
  };
}

function buildItemText(transaction) {
  const parts = [transaction.item || ""];
  if (transaction.specs && typeof transaction.specs === "object") {
    for (const [key, value] of Object.entries(transaction.specs)) {
      parts.push(`${key} ${value}`);
    }
  }
  return parts.join(" ").toLowerCase();
}

function normalizeRestrictions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    // Already structured
    if (r && typeof r === "object" && Array.isArray(r.keywords)) {
      return {
        text: r.text || "",
        type: r.type === "require" ? "require" : "forbid",
        keywords: r.keywords.map((k) => String(k).toLowerCase())
      };
    }
    // Fallback: old string format -> treat as forbid, derive keywords
    const text = String(r || "");
    return {
      text,
      type: "forbid",
      keywords: extractKeywords(text)
    };
  });
}

function normalizeRequirements(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    if (r && typeof r === "object" && Array.isArray(r.keywords)) {
      return {
        text: r.text || "",
        keywords: r.keywords.map((k) => String(k).toLowerCase())
      };
    }
    const text = String(r || "");
    return { text, keywords: extractKeywords(text) };
  });
}

function extractKeywords(phrase) {
  const stopwords = new Set([
    "at", "least", "the", "a", "an", "of", "and", "or", "to",
    "with", "without", "no", "not", "must", "should", "have",
    "be", "is", "for", "in", "on", "it", "that", "this",
    "price", "exceed", "maximum", "minimum", "under", "below"
  ]);
  return phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

module.exports = { evaluateTransaction };
