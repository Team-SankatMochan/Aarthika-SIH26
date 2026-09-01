# Multi-Agent RAG Pipeline - Implementation Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Mobile App (React Native)                                            │
│   ↓ POST /businesses/{id}/generate-report                           │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│ FastAPI Backend                                                      │
│   ↓ Trigger RAG Pipeline                                            │
└─────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────┐
│ RAG Pipeline (LangGraph Multi-Agent System)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Query Embedder                                                   │
│     User query → sentence-transformers → 384-dim vector             │
│                                                                       │
│  2. Context Retriever (pgvector)                                    │
│     SELECT * FROM market_embeddings                                  │
│     ORDER BY embedding <=> query_vector                             │
│     LIMIT 10;                                                        │
│     (Cosine similarity search)                                       │
│                                                                       │
│  3. LangGraph Multi-Agent Orchestration                             │
│     ┌──────────────────────────────────────┐                       │
│     │ Supervisor (Router)                   │                       │
│     └───────┬──────────────────────────────┘                       │
│             │                                                        │
│      ┌──────┴──────┬─────────────┬──────────────┐                 │
│      │             │             │              │                   │
│  ┌───▼────┐  ┌────▼─────┐  ┌───▼─────┐  ┌────▼─────┐           │
│  │Market  │  │  Risk    │  │Financial│  │Recomm-   │           │
│  │Analyst │  │ Actuary  │  │Validator│  │endation  │           │
│  │Agent   │  │  Agent   │  │ Agent   │  │Agent     │           │
│  └────────┘  └──────────┘  └─────────┘  └──────────┘           │
│      │             │             │              │                   │
│      └──────┬──────┴─────────────┴──────────────┘                 │
│             │                                                        │
│     ┌───────▼──────────────────────────────┐                       │
│     │ Report Synthesizer                    │                       │
│     │ (Pydantic validation)                 │                       │
│     └───────────────────────────────────────┘                       │
│             │                                                        │
│             ↓                                                        │
│     Hyper-Local Feasibility Report (JSON)                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Options

### Option 1: FREE Local Setup (Best for SIH Demo)

**Pros:**
- ✅ Zero API costs
- ✅ Works offline
- ✅ Full control
- ✅ Fast iteration

**Cons:**
- ⚠️ Requires decent hardware (8GB+ RAM)
- ⚠️ Slower than cloud APIs

**Tech Stack:**
```python
# LLM
ollama/llama3.2:3b  # 3 billion parameters, runs on 8GB RAM

# Embeddings
sentence-transformers/all-MiniLM-L6-v2  # 384 dimensions, fast

# Vector DB
pgvector (already installed)

# Framework
langgraph==0.2.0
langchain==0.3.0
langchain-community
```

### Option 2: Azure OpenAI (Paid but Professional)

**Pros:**
- ✅ High quality outputs
- ✅ Fast
- ✅ Enterprise ready

**Cons:**
- 💰 ~$0.50-2 per 1M tokens
- 💰 Embeddings: $0.10 per 1M tokens

**Tech Stack:**
```python
# Azure OpenAI
azure-openai
gpt-4o (or gpt-4o-mini for cheaper)
text-embedding-3-small

# Everything else same as Option 1
```

### Option 3: AWS Bedrock (Paid)

**Pros:**
- ✅ Multiple model choices
- ✅ Good pricing

**Cons:**
- 💰 ~$0.30-3 per 1M tokens

**Tech Stack:**
```python
# AWS Bedrock
boto3
Claude 3.5 Sonnet (best quality)
Claude 3 Haiku (cheapest)
Amazon Titan Embeddings

# Everything else same as Option 1
```

### Option 4: FREE Cloud APIs (Limited)

**Groq (FREE for now):**
- llama-3.2-90b-vision-preview
- Extremely fast
- 30 req/min limit
- Great for demos

**Hugging Face Inference API (FREE tier):**
- Llama 3.2, Mistral models
- Rate limited
- Good for testing

## Recommended: Hybrid Approach for SIH

**Development/Demo:** Ollama (free, local)  
**Final Presentation:** Groq or Azure trial credits  
**Production:** Azure OpenAI

## Cost Comparison (Per 1000 Reports)

| Provider | Cost | Speed | Quality |
|----------|------|-------|---------|
| Ollama (local) | $0 | Slow (30s/report) | Good |
| Groq | $0* | Fast (3s/report) | Very Good |
| Azure GPT-4o-mini | $5 | Fast (5s/report) | Excellent |
| Azure GPT-4o | $30 | Fast (5s/report) | Best |
| AWS Bedrock Claude Haiku | $2 | Fast (4s/report) | Very Good |

*Free tier limits apply

## Mathematical Formulas Used

### 1. Cosine Similarity (for RAG retrieval)

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Where:
- A = query embedding vector (384 or 1536 dimensions)
- B = document embedding vector
- · = dot product
- ||A|| = magnitude of vector A

In pgvector SQL:
```sql
SELECT 
    content,
    1 - (embedding <=> query_vector) as similarity
FROM market_embeddings
ORDER BY embedding <=> query_vector
LIMIT 10;
```

The `<=>` operator in pgvector computes cosine distance (1 - cosine similarity).

### 2. Weighted Risk Score (Risk Actuary Agent)

```
Risk Score = 0.4 × Market Risk + 0.3 × Financial Risk + 0.3 × Operational Risk
```

Each component ∈ [0, 1]

### 3. Recommendation Confidence

```
Confidence = (Evidence Strength × Data Recency × Market Match) / Uncertainty
```

Where:
- Evidence Strength ∈ [0, 1] (from retrieved documents)
- Data Recency = e^(-days_old / 90) (exponential decay)
- Market Match = cosine similarity score
- Uncertainty = standard deviation of risk estimates

## Agent Prompt Templates

### Market Analyst Agent
```
You are a Market Analyst specializing in rural Indian businesses.
Analyze the following market data and business proposal:

Business: {business_category}
Location: {location}
Capital: {capital}

Retrieved Market Data:
{retrieved_context}

Provide:
1. SWOT Analysis
2. Competitor landscape
3. Demand estimation
4. Price benchmarking

Output as JSON with confidence scores (0-1) for each insight.
```

### Risk Actuary Agent
```
You are a Risk Actuary. Compare deterministic calculations with market insights:

Deterministic Analysis:
{phase1_calculations}

Market Analyst Report:
{market_analysis}

Identify:
1. Discrepancies between math and market reality
2. Hidden risks not captured by formulas
3. Safer borrowing recommendation
4. Risk mitigation strategies

Rate each risk (0-1): 
- 0-0.3: Low risk
- 0.3-0.7: Medium risk  
- 0.7-1.0: High risk
```

### Financial Validator Agent
```
You are a Financial Validator. Cross-check all numbers:

Proposed Plan:
{business_plan}

Market Analysis:
{market_analysis}

Risk Assessment:
{risk_assessment}

Verify:
1. Revenue projections are realistic given market data
2. Cost estimates align with local prices
3. EMI affordability matches cash flow
4. Working capital is sufficient

Flag any unrealistic assumptions.
```

### Recommendation Agent
```
Synthesize all analyses into a final recommendation:

Market Analysis: {market_analysis}
Risk Assessment: {risk_assessment}
Financial Validation: {financial_validation}

Provide:
1. Final Decision: GO / MODIFY / DO_NOT_INVEST_YET
2. Rationale (3-5 sentences)
3. Confidence level (0-1)
4. If MODIFY: specific changes recommended
5. Next steps for entrepreneur

Use simple language suitable for rural users (8th grade reading level).
```

## Next Steps

Choose your implementation:

**For SIH Demo (Next 2 weeks):**
→ Go with Option 1 (Ollama) - I'll help you set it up

**For Final Presentation:**
→ Upgrade to Groq (free) or Azure trial

**For Production:**
→ Azure OpenAI with proper scaling

Would you like me to:
1. Implement Option 1 (Ollama local setup)
2. Set up Azure OpenAI integration
3. Create the LangGraph multi-agent system
4. Set up pgvector with embeddings

Let me know and I'll start building!
